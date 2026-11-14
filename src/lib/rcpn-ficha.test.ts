import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
import type { Database } from "@/db/index.ts";
import { auditLog, rcpnRecords } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import { createImportWith, publishImportWith } from "./rcpn.ts";
import { getCertidaoWith, issueCertidaoWith } from "./rcpn-certidao.ts";
import {
  cancelRecordWith,
  editedKeysWith,
  FichaError,
  getFichaWith,
  restoreRecordWith,
  saveFichaWith,
  searchRecordsWith,
} from "./rcpn-ficha.ts";

/** The value, or the test fails here: no `!` in the tests. */
function must<T>(value: T | null | undefined): T {
  assert.ok(value !== null && value !== undefined, "valor ausente");
  return value as T;
}

// Fictitious registros only (LGPD).
const OFFICE = "cartorio-ficha";
const M1 = "09461501552020100008530001146600";
const M2 = "09461501552021100009012000020000";

const carga = new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8"?>
<CARGAREGISTROS><MOVIMENTONASCIMENTOTN>
<REGISTRONASCIMENTOINCLUSAO>
  <NOMEREGISTRADO>Joaquina Exemplo da Silva</NOMEREGISTRADO><MATRICULA>${M1}</MATRICULA>
  <DATAREGISTRO>07/07/2020</DATAREGISTRO><DATANASCIMENTO>12/04/2020</DATANASCIMENTO>
  <DNV>123456789</DNV><CPFREGISTRADO>11122233344</CPFREGISTRADO>
  <FILIACAONASCIMENTO><NOME>Márcia Fictícia</NOME><SEXO>F</SEXO></FILIACAONASCIMENTO>
  <FILIACAONASCIMENTO><NOME>Pedro Modelo</NOME><SEXO>M</SEXO></FILIACAONASCIMENTO>
</REGISTRONASCIMENTOINCLUSAO>
<REGISTRONASCIMENTOINCLUSAO>
  <NOMEREGISTRADO>Lucas Teste</NOMEREGISTRADO><MATRICULA>${M2}</MATRICULA>
  <DATAREGISTRO>10/01/2021</DATAREGISTRO><DATANASCIMENTO>05/01/2021</DATANASCIMENTO>
  <FILIACAONASCIMENTO><NOME>Rita Exemplo</NOME><SEXO>F</SEXO></FILIACAONASCIMENTO>
</REGISTRONASCIMENTOINCLUSAO>
</MOVIMENTONASCIMENTOTN></CARGAREGISTROS>`);

let db: Database;
let close: () => Promise<void>;
let firstId = "";
before(async () => {
  ({ db, close } = await createTestDb());
  const { id } = await createImportWith(db, OFFICE, {
    fileName: "NA_INC.xml",
    bytes: carga,
    storedPath: "",
    uploadedBy: "escrevente",
  });
  await publishImportWith(db, OFFICE, id, "escrevente", new Set());
  const [row] = await db
    .select({ id: rcpnRecords.id })
    .from(rcpnRecords)
    .where(eq(rcpnRecords.matricula, M1));
  firstId = must(row).id;
});
after(async () => close());

test("pesquisa por tipo: nome, filiação, termo, livro, DNV, CPF e datas", async () => {
  const q = (
    mode: Parameters<typeof searchRecordsWith>[2]["mode"],
    text: string,
  ) => searchRecordsWith(db, OFFICE, { kind: "nascimento", mode, text });
  assert.equal((await q("nome", "silva joaquina"))[0]?.id, firstId);
  assert.equal((await q("nome", "joakina"))[0]?.fit, "near");
  assert.equal((await q("filiacao", "marcia"))[0]?.id, firstId);
  assert.equal((await q("filiacao", "pedro modelo"))[0]?.id, firstId);
  assert.equal((await q("termo", "11466"))[0]?.id, firstId);
  assert.equal((await q("livro", "A08")).length, 1);
  assert.equal((await q("livro", "a-9")).length, 1);
  assert.equal((await q("dnv", "123.456.789"))[0]?.id, firstId);
  assert.equal((await q("cpf", "111.222.333-44"))[0]?.id, firstId);
  assert.equal((await q("matricula", M2))[0]?.names[0], "Lucas Teste");
  assert.equal(
    (
      await searchRecordsWith(db, OFFICE, {
        kind: "casamento",
        mode: "nome",
        text: "joaquina",
      })
    ).length,
    0,
    "cada tipo pesquisa só o seu livro",
  );
  const byDate = await searchRecordsWith(db, OFFICE, {
    kind: "nascimento",
    mode: "nome",
    text: "",
    dateField: "registro",
    from: "2021-01-01",
    to: "2021-12-31",
  });
  assert.deepEqual(
    byDate.map((h) => h.names[0]),
    ["Lucas Teste"],
  );
});

test("altera com justificativa e guarda o antes e o depois", async () => {
  await assert.rejects(
    saveFichaWith(db, OFFICE, firstId, { "d.avos1": "X" }, "escrevente", ""),
    FichaError,
  );
  await assert.rejects(
    saveFichaWith(
      db,
      OFFICE,
      firstId,
      { "p.registrado.birthDate": "31/02/2020" },
      "escrevente",
      "erro de digitação",
    ),
    /data inválida/,
  );
  const changed = await saveFichaWith(
    db,
    OFFICE,
    firstId,
    {
      "d.avos1": "Avô Fictício; Avó Fictícia",
      "p.registrado.name": "Joaquina Exemplo da Silva",
      "p.registrado.birthDate": "13/04/2020",
      "d.observacoes": "Anotação fictícia.\n\nSegunda anotação.",
    },
    "escrevente",
    "Conferido com o livro A-8, folha 530.",
  );
  assert.equal(changed, 3, "o nome igual não conta");
  const ficha = must(await getFichaWith(db, OFFICE, firstId));
  assert.equal(ficha.record.details?.avos1, "Avô Fictício; Avó Fictícia");
  assert.equal(ficha.record.people[0]?.birthDate, "2020-04-13");
  assert.ok(ficha.editedAt);
  assert.equal(ficha.history[0]?.kind, "edicao");
  assert.deepEqual(
    ficha.history[0]?.changes.find((c) => c.key === "p.registrado.birthDate"),
    {
      key: "p.registrado.birthDate",
      label: "Data de nascimento",
      before: "2020-04-12",
      after: "2020-04-13",
    },
  );
  assert.ok((await editedKeysWith(db, OFFICE)).has(`nascimento:${M1}`));
  assert.equal(
    (
      await searchRecordsWith(db, OFFICE, {
        kind: "nascimento",
        mode: "avos",
        text: "avo ficticio",
      })
    )[0]?.id,
    firstId,
  );
});

test("cancela e estorna sem apagar, com a auditoria", async () => {
  await cancelRecordWith(
    db,
    OFFICE,
    firstId,
    "tabeliao",
    "Lançado em duplicidade.",
  );
  await assert.rejects(
    cancelRecordWith(db, OFFICE, firstId, "tabeliao", "de novo"),
    /já está cancelado/,
  );
  let ficha = must(await getFichaWith(db, OFFICE, firstId));
  assert.ok(ficha.canceledAt);
  assert.equal(ficha.cancelReason, "Lançado em duplicidade.");
  const hit = await searchRecordsWith(db, OFFICE, {
    kind: "nascimento",
    mode: "termo",
    text: "11466",
  });
  assert.equal(hit[0]?.canceled, true, "o cancelado aparece, marcado");

  await restoreRecordWith(
    db,
    OFFICE,
    firstId,
    "tabeliao",
    "Cancelado por engano.",
  );
  ficha = must(await getFichaWith(db, OFFICE, firstId));
  assert.equal(ficha.canceledAt, null);
  assert.deepEqual(ficha.history.map((h) => h.kind).sort(), [
    "cancelamento",
    "edicao",
    "estorno",
  ]);
  const audit = await db
    .select({ action: auditLog.action, reason: auditLog.reason })
    .from(auditLog)
    .where(eq(auditLog.targetId, firstId));
  assert.deepEqual(audit.map((a) => a.action).sort(), [
    "rcpn.record.cancel",
    "rcpn.record.edit",
    "rcpn.record.restore",
  ]);
  assert.ok(audit.every((a) => a.reason));
});

test("a matrícula não se altera no painel", async () => {
  const changed = await saveFichaWith(
    db,
    OFFICE,
    firstId,
    { "r.matricula": "99999999999999999999999999999999", "d.cor": "PARDA" },
    "escrevente",
    "Tentativa de mudar a matrícula.",
  );
  assert.equal(changed, 1, "só a cor muda");
  const ficha = must(await getFichaWith(db, OFFICE, firstId));
  assert.equal(ficha.record.matricula, M1);
});

test("a certidão de um registro leva a matrícula do registro, não a digitada", async () => {
  const id = await issueCertidaoWith(
    db,
    OFFICE,
    {
      kind: "nascimento",
      form: "breve",
      subtype: "",
      recordId: firstId,
      fields: {
        nome: "Joaquina Exemplo da Silva",
        matricula: "11111111111111111111111111111111",
      },
      seal: "RN-FICTICIO-MATRICULA",
      sealKind: "Isento",
      fees: "",
      signerName: "Escrevente Fictícia",
      signerTitle: "Escrevente",
      checked: true,
    },
    "escrevente",
  );
  const row = must(await getCertidaoWith(db, OFFICE, id));
  const digits = (row.fields as Record<string, string>).matricula?.replace(
    /\D/g,
    "",
  );
  assert.equal(digits, M1);
});
