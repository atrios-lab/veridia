import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
import type { Database } from "@/db/index.ts";
import { auditLog } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  conferenceFor,
  coverageWith,
  createImportWith,
  discardImportWith,
  getImportWith,
  publishImportWith,
  RcpnImportError,
  searchWith,
} from "./rcpn.ts";

/** The value, or the test fails here: no `!` in the tests. */
function must<T>(value: T | null | undefined): T {
  assert.ok(value !== null && value !== undefined, "valor ausente");
  return value as T;
}

// Fictitious registros only (LGPD): the carga XML is the format the office
// generates for each new registro, so it stands for any file here.
const OFFICE = "cartorio-marinho";
const M1 = "09461501552025100010010000011111";
const M2 = "09461501552025100010010000022222";

function carga(
  people: { m: string; name: string; mother: string; birth: string }[],
): Uint8Array {
  const registros = people
    .map(
      (p) => `<REGISTRONASCIMENTOINCLUSAO>
  <NOMEREGISTRADO>${p.name}</NOMEREGISTRADO><MATRICULA>${p.m}</MATRICULA>
  <DATAREGISTRO>02/09/2025</DATAREGISTRO><DATANASCIMENTO>${p.birth}</DATANASCIMENTO>
  <FILIACAONASCIMENTO><NOME>${p.mother}</NOME><SEXO>F</SEXO></FILIACAONASCIMENTO>
  <FILIACAONASCIMENTO><NOME>Pai Fictício</NOME><SEXO>M</SEXO></FILIACAONASCIMENTO>
</REGISTRONASCIMENTOINCLUSAO>`,
    )
    .join("");
  return new TextEncoder().encode(
    `<?xml version="1.0" encoding="UTF-8"?><CARGAREGISTROS><VERSAO>1</VERSAO><MOVIMENTONASCIMENTOTN>${registros}</MOVIMENTONASCIMENTOTN></CARGAREGISTROS>`,
  );
}

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => close());

async function open(bytes: Uint8Array, fileName = "NA_INC.xml") {
  return createImportWith(db, OFFICE, {
    fileName,
    bytes,
    storedPath: "",
    uploadedBy: "escrevente",
  });
}

test("importa, publica e pesquisa; o mesmo arquivo não entra duas vezes", async () => {
  const bytes = carga([
    {
      m: M1,
      name: "Ana Teste da Silva",
      mother: "Beatriz Exemplo",
      birth: "30/08/2025",
    },
    {
      m: M2,
      name: "Caio Fictício",
      mother: "Dora Exemplo",
      birth: "01/09/2025",
    },
  ]);
  const { id } = await open(bytes);
  const row = await getImportWith(db, OFFICE, id);
  assert.equal(row?.status, "lida");
  assert.equal(row?.format, "carga-xml");
  await assert.rejects(open(bytes), RcpnImportError);

  const conf = await conferenceFor(db, OFFICE, must(row));
  assert.equal(conf.counts.novo, 2);
  assert.equal(
    await publishImportWith(db, OFFICE, id, "escrevente", new Set()),
    2,
  );

  const closed = await getImportWith(db, OFFICE, id);
  assert.equal(closed?.status, "publicada");
  assert.equal(closed?.records, null);
  assert.equal(closed?.storedPath, null);

  const hits = await searchWith(db, OFFICE, { name: "silva ana" });
  assert.equal(hits.length, 1);
  assert.equal(hits[0]?.person.motherName, "Beatriz Exemplo");
  const typo = await searchWith(db, OFFICE, {
    name: "Caio Ficticio",
    mother: "Dora Exenplo",
  });
  assert.equal(typo[0]?.fit, "near");
  assert.equal(
    (await searchWith(db, OFFICE, { name: "", birthDate: "2025-09-01" }))
      .length,
    1,
  );

  const coverage = await coverageWith(db, OFFICE);
  assert.equal(coverage.find((c) => c.kind === "nascimento")?.count, 2);
  assert.equal(
    coverage.find((c) => c.kind === "nascimento")?.first,
    "2025-09-02",
  );

  const audits = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.targetId, id));
  assert.deepEqual(audits.map((a) => a.action).sort(), [
    "rcpn.import.publish",
    "rcpn.import.upload",
  ]);
});

test("registro que já existe: igual não muda; alterado só substitui se escolhido", async () => {
  const bytes = carga([
    {
      m: M1,
      name: "Ana Teste da Silva",
      mother: "Beatriz Exemplo Corrigida",
      birth: "30/08/2025",
    },
    {
      m: M2,
      name: "Caio Fictício",
      mother: "Dora Exemplo",
      birth: "01/09/2025",
    },
  ]);
  const { id } = await open(bytes, "NA_INC_2.xml");
  const row = await getImportWith(db, OFFICE, id);
  const conf = await conferenceFor(db, OFFICE, must(row));
  assert.deepEqual(
    [conf.counts.alterado, conf.counts.igual, conf.counts.novo],
    [1, 1, 0],
  );
  assert.deepEqual(
    conf.checked.find((c) => c.comparison === "alterado")?.changes,
    ["mãe"],
  );

  // Without choosing, nothing is replaced.
  assert.equal(
    await publishImportWith(db, OFFICE, id, "escrevente", new Set()),
    0,
  );
  assert.equal(
    (await searchWith(db, OFFICE, { name: "Ana Teste" }))[0]?.person.motherName,
    "Beatriz Exemplo",
  );

  const again = await open(
    carga([
      {
        m: M1,
        name: "Ana Teste da Silva",
        mother: "Beatriz Exemplo Corrigida",
        birth: "30/08/2025",
      },
    ]),
    "NA_INC_3.xml",
  );
  assert.equal(
    await publishImportWith(
      db,
      OFFICE,
      again.id,
      "escrevente",
      new Set([`nascimento:${M1}`]),
    ),
    1,
  );
  assert.equal(
    (await searchWith(db, OFFICE, { name: "Ana Teste" }))[0]?.person.motherName,
    "Beatriz Exemplo Corrigida",
  );
});

test("descartar encerra sem mexer no índice; arquivo não reconhecido fica guardado", async () => {
  const { id } = await open(
    new TextEncoder().encode("texto qualquer"),
    "anotacoes.txt",
  );
  const row = await getImportWith(db, OFFICE, id);
  assert.equal(row?.status, "nao-lida");
  assert.match(String((row?.notes as string[])[0]), /ainda não lido/);
  await discardImportWith(db, OFFICE, id, "escrevente");
  assert.equal((await getImportWith(db, OFFICE, id))?.status, "descartada");
  await assert.rejects(
    discardImportWith(db, OFFICE, id, "escrevente"),
    RcpnImportError,
  );
  // Another office never sees these.
  assert.equal(
    (await searchWith(db, "cartorio-exemplo", { name: "Ana" })).length,
    0,
  );
});
