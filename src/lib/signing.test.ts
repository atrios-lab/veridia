import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import PDFDocument from "pdfkit";
import { getAct } from "@/core/acts/catalog.ts";
import { hashAccessKey } from "@/core/request/access-key.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import { user } from "@/db/auth-schema.ts";
import type { Database } from "@/db/index.ts";
import { serviceRequestAttachments } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  attachToRequestWith,
  createServiceRequestWith,
} from "./service-request.ts";
import {
  CertificatePasswordError,
  openCertificate,
} from "./signature/certificate.ts";
import { hasSignature } from "./signature/pades.ts";
import { createTestPki } from "./signature/test-pki.ts";
import {
  addCertificateWith,
  certificatesForSignerWith,
  coSignDocumentWith,
  disableCertificateWith,
  findSignedDocumentWith,
  finishA3SignWith,
  listCertificatesWith,
  listSignedDocumentsWith,
  prepareA3CoSignWith,
  prepareA3SignWith,
  SigningError,
  setCertificateSignersWith,
  setSignedDocumentRemovedWith,
  signDeliveredDocumentWith,
  signNewDocumentWith,
  unsignedDeliveries,
} from "./signing.ts";
import { readStoredFile, storeOfficePdf } from "./uploads.ts";

// Files go to a scratch folder; the vault needs a key.
process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), "assinador-"));
process.env.BETTER_AUTH_SECRET ??= "segredo-de-teste-com-mais-de-32-caracteres";

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
  // Fictitious people only (LGPD).
  await db.insert(user).values([
    {
      id: "titular",
      name: "Maria Exemplo da Silva",
      email: "maria.assinador@exemplo.com",
      tenantSlug: TENANT,
      role: "admin",
    },
    {
      id: "escrevente",
      name: "João Fictício de Souza",
      email: "joao.assinador@exemplo.com",
      tenantSlug: TENANT,
      role: "staff",
    },
  ]);
});
after(async () => {
  await close();
});

const TENANT = "cartorio-marinho";

async function byLabel() {
  const all = await listCertificatesWith(db, TENANT);
  const pick = (label: string) => {
    const found = all.find((c) => c.label === label);
    if (!found) throw new Error(`sem ${label}`);
    return found;
  };
  return { titular: pick("Titular"), cnpj: pick("e-CNPJ") };
}
const pki = createTestPki();
const mariaPfx = pki.issue(
  "MARIA EXEMPLO DA SILVA:52998224725",
  "senha-a1",
  "21",
);
const officePfx = pki.issue(
  "CARTORIO EXEMPLO LTDA:11222333000181",
  "senha-cnpj",
  "22",
);

function samplePdf(): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.text("Certidão de teste, com dados fictícios.");
    doc.end();
  });
}

const sign = (
  certificateId: string,
  pdf: Buffer,
  password: string,
  who: string,
  now: Date,
) =>
  signNewDocumentWith(
    db,
    TENANT,
    {
      certificateId,
      password,
      pdf,
      title: "Certidão de teste",
      originalName: "certidao.pdf",
      verifyUrl: (code) => `https://cartorio.exemplo/verificar/${code}`,
      location: "Ielmo Marinho/RN",
      officeName: "Cartório Exemplo de Notas",
    },
    who,
    now,
  );

test("o administrador cadastra os A1 e escolhe quem assina; a senha nunca fica", async () => {
  await assert.rejects(
    addCertificateWith(
      db,
      TENANT,
      { label: "Titular", pfx: mariaPfx, password: "errada" },
      "titular",
    ),
    CertificatePasswordError,
  );
  const info = await addCertificateWith(
    db,
    TENANT,
    { label: "Titular", pfx: mariaPfx, password: "senha-a1" },
    "titular",
  );
  assert.equal(info.holderName, "MARIA EXEMPLO DA SILVA");
  await addCertificateWith(
    db,
    TENANT,
    { label: "e-CNPJ", pfx: officePfx, password: "senha-cnpj" },
    "titular",
  );
  // The same certificate twice is refused.
  await assert.rejects(
    addCertificateWith(
      db,
      TENANT,
      { label: "De novo", pfx: mariaPfx, password: "senha-a1" },
      "titular",
    ),
    SigningError,
  );

  const { cnpj, titular } = await byLabel();
  assert.equal(titular.kind, "cpf");
  assert.equal(cnpj.kind, "cnpj");
  await setCertificateSignersWith(
    db,
    TENANT,
    titular.id,
    ["titular"],
    "titular",
  );
  await setCertificateSignersWith(
    db,
    TENANT,
    cnpj.id,
    ["titular", "escrevente", "de-outro-cartorio"],
    "titular",
  );
  assert.deepEqual(
    (await certificatesForSignerWith(db, TENANT, "escrevente")).map(
      (c) => c.label,
    ),
    ["e-CNPJ"],
  );
  // Nothing of the password in the stored row.
  const stored = JSON.stringify(await listCertificatesWith(db, TENANT));
  assert.doesNotMatch(stored, /senha-a1|senha-cnpj/);
});

test("assina, coassina, verifica por código e por arquivo, e guarda o arquivo 6 meses", async () => {
  const { cnpj, titular } = await byLabel();
  const at = new Date("2026-11-10T13:00:00Z");
  const pdf = await samplePdf();

  // Not authorized for the titular's certificate.
  await assert.rejects(
    sign(titular.id, pdf, "senha-a1", "escrevente", at),
    /não está autorizado/,
  );
  // Wrong password at signing time.
  await assert.rejects(
    sign(titular.id, pdf, "errada", "titular", at),
    CertificatePasswordError,
  );

  const { id, code } = await sign(titular.id, pdf, "senha-a1", "titular", at);
  assert.match(code, /^[2-9A-HJ-NP-Z]{12}$/);
  const first = await findSignedDocumentWith(
    db,
    TENANT,
    { code: `${code.slice(0, 4).toLowerCase()}-${code.slice(4)}` },
    at,
  );
  assert.equal(first?.id, id);
  assert.equal(first?.signatures.length, 1);
  assert.equal(first?.signatures[0].holderName, "MARIA EXEMPLO DA SILVA");

  await coSignDocumentWith(
    db,
    TENANT,
    id,
    {
      certificateId: cnpj.id,
      password: "senha-cnpj",
      location: "Ielmo Marinho/RN",
    },
    "escrevente",
    new Date("2026-11-10T13:10:00Z"),
  );
  const both = await findSignedDocumentWith(db, TENANT, { id }, at);
  assert.deepEqual(
    both?.signatures.map((s) => s.holderName),
    ["MARIA EXEMPLO DA SILVA", "CARTORIO EXEMPLO LTDA"],
  );
  // Someone sends the file they received: found by its hash.
  const file = await readStoredFile(both?.filePath ?? "");
  const { createHash } = await import("node:crypto");
  const hash = createHash("sha256").update(file).digest("hex");
  assert.equal(
    (await findSignedDocumentWith(db, TENANT, { sha256: hash }, at))?.id,
    id,
  );
  // Another office's site does not find it.
  assert.equal(
    await findSignedDocumentWith(db, "outro-cartorio", { code }, at),
    undefined,
  );

  // Six months later the file goes; the record and the check stay.
  const later = new Date("2027-05-11T13:10:01Z");
  const old = await findSignedDocumentWith(db, TENANT, { code }, later);
  assert.equal(old?.filePath, null);
  assert.ok(old?.filePurgedAt);
  assert.equal(old?.signatures.length, 2);
  await assert.rejects(
    coSignDocumentWith(
      db,
      TENANT,
      id,
      { certificateId: cnpj.id, password: "senha-cnpj", location: "x" },
      "escrevente",
      later,
    ),
    /6 meses/,
  );
});

test("o documento entregue sem assinatura é lembrado e assinado pela plataforma", async () => {
  const { titular } = await byLabel();
  const act = getAct("notas-ata-notarial");
  if (!act) throw new Error("catálogo incompleto");
  const request = await createServiceRequestWith(db, TENANTS[TENANT], act, {
    applicantName: "Ana Exemplo Pereira",
    contact: "ana@exemplo.com",
    accessKeyHash: hashAccessKey("CHAVE-EXEMPLO-ENTREGA"),
  });
  const stored = await storeOfficePdf(TENANT, await samplePdf());
  await attachToRequestWith(
    db,
    TENANT,
    request.id,
    [
      {
        storedName: stored.storedName,
        displayName: "documento-final",
        path: stored.path,
        mimeType: "application/pdf",
        sizeBytes: 1000,
      },
    ],
    "office",
  );
  const [delivered] = (await db.select().from(serviceRequestAttachments)) as {
    id: string;
    kind: string;
    mimeType: string;
    path: string | null;
    sizeBytes: number;
    requestId: string;
  }[];
  const mine = [delivered].filter((a) => a.requestId === request.id);
  assert.deepEqual([...(await unsignedDeliveries(mine))], [delivered.id]);

  const { code } = await signDeliveredDocumentWith(
    db,
    TENANT,
    {
      requestId: request.id,
      attachmentId: delivered.id,
      protocolNumber: request.protocolNumber,
      certificateId: titular.id,
      password: "senha-a1",
      verifyUrl: (c) => `https://cartorio.exemplo/verificar/${c}`,
      location: "Ielmo Marinho/RN",
      officeName: "Cartório Exemplo de Notas",
    },
    "titular",
    new Date("2026-11-10T15:00:00Z"),
  );
  assert.match(code, /^[2-9A-HJ-NP-Z]{12}$/);
  const [after] = (await db.select().from(serviceRequestAttachments)) as {
    id: string;
    path: string | null;
  }[];
  assert.notEqual(after.path, delivered.path);
  assert.ok(hasSignature(await readStoredFile(after.path ?? "")));
  // Signing twice is refused.
  await assert.rejects(
    signDeliveredDocumentWith(
      db,
      TENANT,
      {
        requestId: request.id,
        attachmentId: delivered.id,
        protocolNumber: request.protocolNumber,
        certificateId: titular.id,
        password: "senha-a1",
        verifyUrl: (c) => c,
        location: "x",
        officeName: "Cartório Exemplo de Notas",
      },
      "titular",
    ),
    /já está assinado/,
  );
});

test("certificado desativado não assina mais", async () => {
  const { cnpj } = await byLabel();
  assert.ok(await disableCertificateWith(db, TENANT, cnpj.id, "titular"));
  await assert.rejects(
    sign(
      cnpj.id,
      await samplePdf(),
      "senha-cnpj",
      "escrevente",
      new Date("2026-11-11T12:00:00Z"),
    ),
    /não está autorizado/,
  );
});

test("excluir da lista não apaga: o arquivo deixa de abrir, a verificação continua e dá para devolver", async () => {
  const { titular } = await byLabel();
  const at = new Date("2026-11-11T13:00:00Z");
  const { id, code } = await sign(
    titular.id,
    await samplePdf(),
    "senha-a1",
    "titular",
    at,
  );
  assert.ok(
    (await listSignedDocumentsWith(db, TENANT, at)).some((d) => d.id === id),
  );
  assert.equal(
    await setSignedDocumentRemovedWith(db, TENANT, id, true, "titular", at),
    true,
  );
  const removed = await findSignedDocumentWith(db, TENANT, { code }, at);
  assert.ok(removed?.removedAt);
  assert.equal(removed?.filePath, null);
  assert.equal(removed?.signatures.length, 1);
  assert.ok(
    !(await listSignedDocumentsWith(db, TENANT, at)).some((d) => d.id === id),
  );
  assert.ok(
    (await listSignedDocumentsWith(db, TENANT, at, { removed: true })).some(
      (d) => d.id === id,
    ),
  );
  // Another office cannot touch it.
  assert.equal(
    await setSignedDocumentRemovedWith(db, "outro-cartorio", id, false, "x"),
    false,
  );
  await setSignedDocumentRemovedWith(db, TENANT, id, false, "titular", at);
  const back = await findSignedDocumentWith(db, TENANT, { id }, at);
  assert.equal(back?.removedAt, null);
  assert.ok(back?.filePath);
});

test("PDF que já vem assinado recebe a faixa como assinatura visível na primeira página", async () => {
  const { titular } = await byLabel();
  const at = new Date("2026-11-11T14:00:00Z");
  const first = await sign(
    titular.id,
    await samplePdf(),
    "senha-a1",
    "titular",
    at,
  );
  const signedOnce = await readStoredFile(
    (await findSignedDocumentWith(db, TENANT, { id: first.id }, at))
      ?.filePath ?? "",
  );
  // That signed PDF comes back as a new document (like a CNH, signed
  // elsewhere): its pages are not touched, the new signature shows.
  const again = await sign(titular.id, signedOnce, "senha-a1", "titular", at);
  const file = await readStoredFile(
    (await findSignedDocumentWith(db, TENANT, { id: again.id }, at))
      ?.filePath ?? "",
  );
  assert.ok(file.subarray(0, signedOnce.length).equals(signedOnce));
  assert.match(
    file.subarray(signedOnce.length).toString("latin1"),
    /\/AP <<\s*\/N \d+ 0 R\s*>>/,
  );
});

test("A3: a plataforma prepara, o token assina fora, e só a assinatura certa é salva", async () => {
  const { sign: rsaSign } = await import("node:crypto");
  const forge = (await import("node-forge")).default;
  // The token: the key never goes to the platform, only the certificate.
  const token = openCertificate(
    pki.issue("JOAO FICTICIO DE SOUZA:11144477735", "pin", "31"),
    "pin",
  );
  const other = openCertificate(
    pki.issue("ANA MODELO PEREIRA:39053344705", "pin", "32"),
    "pin",
  );
  const pinSign = (key: typeof token, bytes: Buffer) =>
    rsaSign("sha256", bytes, forge.pki.privateKeyToPem(key.privateKey));
  const cert = { holderDer: token.holderDer, chainDer: token.chainDer };
  const at = new Date("2026-11-11T14:00:00Z");
  const pdf = await samplePdf();
  const input = {
    ...cert,
    pdf,
    title: "Escritura fictícia",
    originalName: "escritura.pdf",
    verifyUrl: (code: string) => `https://cartorio.exemplo/verificar/${code}`,
    location: "Ielmo Marinho/RN",
    officeName: "Cartório Exemplo de Notas",
  };

  const prepared = await prepareA3SignWith(TENANT, input, "escrevente", at);
  // Another key's signature over the same bytes: refused, nothing saved.
  await assert.rejects(
    finishA3SignWith(
      db,
      TENANT,
      {
        ...cert,
        token: prepared.token,
        signature: pinSign(other, prepared.toBeSigned),
      },
      "escrevente",
      at,
    ),
    /não confere/,
  );
  // Someone else cannot finish it, nor a changed token.
  await assert.rejects(
    finishA3SignWith(
      db,
      TENANT,
      {
        ...cert,
        token: prepared.token,
        signature: pinSign(token, prepared.toBeSigned),
      },
      "titular",
      at,
    ),
    SigningError,
  );
  await assert.rejects(
    finishA3SignWith(
      db,
      TENANT,
      {
        ...cert,
        token: `${prepared.token.slice(0, -4)}AAAA`,
        signature: pinSign(token, prepared.toBeSigned),
      },
      "escrevente",
      at,
    ),
    SigningError,
  );
  // After 15 minutes the preparation is gone.
  await assert.rejects(
    finishA3SignWith(
      db,
      TENANT,
      {
        ...cert,
        token: prepared.token,
        signature: pinSign(token, prepared.toBeSigned),
      },
      "escrevente",
      new Date(at.getTime() + 16 * 60_000),
    ),
    /venceu/,
  );

  const done = await finishA3SignWith(
    db,
    TENANT,
    {
      ...cert,
      token: prepared.token,
      signature: pinSign(token, prepared.toBeSigned),
    },
    "escrevente",
    at,
  );
  // Used once.
  await assert.rejects(
    finishA3SignWith(
      db,
      TENANT,
      {
        ...cert,
        token: prepared.token,
        signature: pinSign(token, prepared.toBeSigned),
      },
      "escrevente",
      at,
    ),
    /já foi concluída/,
  );
  const found = await findSignedDocumentWith(db, TENANT, { id: done.id }, at);
  assert.equal(found?.code, done.code);
  assert.equal(found?.signatures[0].holderName, "JOAO FICTICIO DE SOUZA");
  const file = await readStoredFile(found?.filePath ?? "");
  assert.ok(hasSignature(file));

  // One more A3 signature on the same document keeps the first one.
  const second = { holderDer: other.holderDer, chainDer: other.chainDer };
  const again = await prepareA3CoSignWith(
    db,
    TENANT,
    done.id,
    { ...second, location: "Ielmo Marinho/RN" },
    "titular",
    at,
  );
  await finishA3SignWith(
    db,
    TENANT,
    {
      ...second,
      token: again.token,
      signature: pinSign(other, again.toBeSigned),
    },
    "titular",
    at,
  );
  const both = await findSignedDocumentWith(db, TENANT, { id: done.id }, at);
  assert.deepEqual(
    both?.signatures.map((s) => s.holderName),
    ["JOAO FICTICIO DE SOUZA", "ANA MODELO PEREIRA"],
  );

  // A certificate with no CPF/CNPJ is not ICP-Brasil: refused up front.
  const plain = openCertificate(pki.issue("Fulano", "pin", "33"), "pin");
  await assert.rejects(
    prepareA3SignWith(
      TENANT,
      { ...input, holderDer: plain.holderDer, chainDer: plain.chainDer },
      "escrevente",
      at,
    ),
    /CPF ou CNPJ/,
  );
});
