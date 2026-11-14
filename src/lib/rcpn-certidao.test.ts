import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
import type { Database } from "@/db/index.ts";
import { auditLog, rcpnCertidoes } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  CertidaoError,
  type CertidaoInput,
  getCertidaoWith,
  issueCertidaoWith,
  listCertidoesWith,
  removeCertidaoWith,
  updateCertidaoWith,
} from "./rcpn-certidao.ts";

// Fictitious data only (LGPD).
const OFFICE = "cartorio-marinho";
const M = "094615 01 55 2025 1 00010 010 0000111 11";

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => close());

let sealCount = 0;
const input = (over: Partial<CertidaoInput> = {}): CertidaoInput => ({
  kind: "nascimento",
  form: "breve",
  subtype: "",
  recordId: null,
  fields: { nome: "Criança Fictícia", matricula: M },
  seal: `RN-FICTICIO-${++sealCount}`,
  sealKind: "Isento",
  fees: "",
  signerName: "Escrevente Fictícia",
  signerTitle: "Escrevente",
  checked: true,
  ...over,
});

test("emite só depois de conferida com o livro e com matrícula válida", async () => {
  await assert.rejects(
    issueCertidaoWith(db, OFFICE, input({ checked: false }), "escrevente"),
    CertidaoError,
  );
  await assert.rejects(
    issueCertidaoWith(
      db,
      OFFICE,
      input({ fields: { nome: "Criança Fictícia", matricula: "1" } }),
      "escrevente",
    ),
    /32 dígitos/,
  );
  const id = await issueCertidaoWith(db, OFFICE, input(), "escrevente");
  const row = await getCertidaoWith(db, OFFICE, id);
  assert.equal(
    (row?.fields as Record<string, string>).nome,
    "Criança Fictícia",
  );
  assert.match(row?.seal ?? "", /^RN-FICTICIO-\d+$/);
});

test("natimorto só no óbito; registro de outro tipo é recusado", async () => {
  const id = await issueCertidaoWith(
    db,
    OFFICE,
    input({ kind: "obito", subtype: "natimorto" }),
    "escrevente",
  );
  assert.equal((await getCertidaoWith(db, OFFICE, id))?.subtype, "natimorto");
  const other = await issueCertidaoWith(
    db,
    OFFICE,
    input({ subtype: "natimorto" }),
    "escrevente",
  );
  assert.equal((await getCertidaoWith(db, OFFICE, other))?.subtype, "");
  await assert.rejects(
    issueCertidaoWith(
      db,
      OFFICE,
      input({ recordId: "00000000-0000-0000-0000-000000000000" }),
      "escrevente",
    ),
    /não está no índice/,
  );
});

test("corrigir muda o texto; excluir só marca, a linha e a auditoria ficam", async () => {
  const id = await issueCertidaoWith(db, OFFICE, input(), "escrevente");
  await updateCertidaoWith(
    db,
    OFFICE,
    id,
    input({ fields: { nome: "Criança Fictícia Corrigida", matricula: M } }),
    "escrevente",
  );
  const fixed = await getCertidaoWith(db, OFFICE, id);
  assert.equal(
    (fixed?.fields as Record<string, string>).nome,
    "Criança Fictícia Corrigida",
  );
  assert.ok(fixed?.updatedAt);

  await removeCertidaoWith(
    db,
    OFFICE,
    id,
    "tabeliao",
    "emitida em duplicidade",
  );
  assert.equal(await getCertidaoWith(db, OFFICE, id), null);
  assert.equal(
    (await listCertidoesWith(db, OFFICE)).some((r) => r.id === id),
    false,
  );
  const [kept] = await db
    .select()
    .from(rcpnCertidoes)
    .where(eq(rcpnCertidoes.id, id));
  assert.equal(kept?.removedReason, "emitida em duplicidade");
  const acts = (
    await db.select().from(auditLog).where(eq(auditLog.targetId, id))
  ).map((a) => a.action);
  assert.deepEqual(acts.sort(), [
    "rcpn.certidao.edit",
    "rcpn.certidao.issue",
    "rcpn.certidao.remove",
  ]);
});

test("o mesmo selo não vai em duas certidões", async () => {
  const seal = "RN-FICTICIO-SELO-UNICO";
  const id = await issueCertidaoWith(db, OFFICE, input({ seal }), "escrevente");
  await assert.rejects(
    issueCertidaoWith(db, OFFICE, input({ seal }), "escrevente"),
    /já está em outra certidão/,
  );
  // Correcting the same certidão keeps its own selo.
  await updateCertidaoWith(db, OFFICE, id, input({ seal }), "escrevente");
  // Excluded, the selo can be pasted again (the exclusion stays audited).
  await removeCertidaoWith(db, OFFICE, id, "tabeliao", "selo lançado errado");
  await issueCertidaoWith(db, OFFICE, input({ seal }), "escrevente");
});

test("inteiro teor fica guardado como tal e corrige no mesmo modelo", async () => {
  const id = await issueCertidaoWith(
    db,
    OFFICE,
    input({
      form: "inteiro-teor",
      fields: {
        nome: "Criança Fictícia",
        matricula: M,
        teor: "Texto fictício.",
      },
    }),
    "escrevente",
  );
  const row = await getCertidaoWith(db, OFFICE, id);
  assert.equal(row?.form, "inteiro-teor");
  await updateCertidaoWith(
    db,
    OFFICE,
    id,
    input({
      fields: { nome: "Criança Fictícia", matricula: M, teor: "Corrigido." },
    }),
    "escrevente",
  );
  const fixed = await getCertidaoWith(db, OFFICE, id);
  assert.equal((fixed?.fields as Record<string, string>).teor, "Corrigido.");
});
