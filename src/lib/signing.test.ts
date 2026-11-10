import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import PDFDocument from "pdfkit";
import { user } from "@/db/auth-schema.ts";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import { CertificatePasswordError } from "./signature/certificate.ts";
import { createTestPki } from "./signature/test-pki.ts";
import {
  addCertificateWith,
  certificatesForSignerWith,
  coSignDocumentWith,
  disableCertificateWith,
  findSignedDocumentWith,
  listCertificatesWith,
  SigningError,
  setCertificateSignersWith,
  signNewDocumentWith,
} from "./signing.ts";
import { readStoredFile } from "./uploads.ts";

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
