import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { situationOf } from "@/core/ri/acts.ts";
import { readProperty } from "@/core/ri/property.ts";
import { parseCsv, readSheet } from "@/core/ri/sheet.ts";
import type { Database } from "@/db/index.ts";
import { auditLog, riActs, riProperties } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  createActWith,
  createPropertyWith,
  exportFileWith,
  generateExportWith,
  importSheetWith,
  loadAcervoWith,
  markExportImportedWith,
  propertyDetailWith,
  RiError,
  readActInput,
  saveRiSettingsWith,
  setActDeletedWith,
  setPropertyDeletedWith,
  updateActWith,
  updatePropertyWith,
  withdrawExportWith,
} from "./ri.ts";

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

// Fictitious people and imóveis only (LGPD).
const TENANT = "cartorio-teste-ri";
const ACTOR = { id: "u-oficial" };
const OFFICE = { slug: TENANT, cns: "123456", state: "RN" };

const form = (over: Record<string, string> = {}) =>
  readProperty({
    number: "10",
    book: "2",
    location: "1",
    streetKind: "121",
    street: "Exemplo",
    "rural.denominacao": "Fazenda Exemplo",
    priorActs: "3",
    ...over,
  });

const actForm = (over: Partial<Parameters<typeof readActInput>[0]> = {}) =>
  readActInput({
    kind: "R",
    effect: "transmissao",
    nature: "Compra e venda",
    registeredOn: "10/01/2026",
    summary: "",
    cancelsActId: "",
    protocol: "",
    seal: "SELO-FICTICIO-1",
    value: "100.000,00",
    parties: [
      {
        name: "Ana Fictícia",
        document: "11144477735",
        role: "adquirente",
        share: "100%",
      },
    ],
    ...over,
  });

test("matrícula: cria, altera com histórico, apaga e restaura sem tirar do banco", async () => {
  const id = await createPropertyWith(db, TENANT, form(), ACTOR);
  const changed = await updatePropertyWith(
    db,
    TENANT,
    id,
    form({ area: "12 ha" }),
    ACTOR,
  );
  assert.equal(changed, 1);
  const detail = await propertyDetailWith(db, TENANT, id);
  assert.equal(detail?.property.area, "12 ha");
  assert.equal(detail?.property.history[0]?.changes[0]?.field, "area");
  await setPropertyDeletedWith(db, TENANT, id, true, ACTOR);
  assert.equal((await loadAcervoWith(db, TENANT)).properties.length, 0);
  const [row] = await db.select().from(riProperties);
  assert.ok(row?.deletedAt);
  await setPropertyDeletedWith(db, TENANT, id, false, ACTOR);
  assert.equal((await loadAcervoWith(db, TENANT)).properties.length, 1);
});

test("atos: numeram depois da ficha, cancelam ônus, apagam sem reusar o número", async () => {
  const id = await createPropertyWith(
    db,
    TENANT,
    form({ number: "11" }),
    ACTOR,
  );
  const first = await createActWith(db, TENANT, id, actForm(), ACTOR);
  assert.equal(first.seq, 4);
  const lien = await createActWith(
    db,
    TENANT,
    id,
    actForm({
      nature: "Hipoteca",
      effect: "onus",
      parties: [
        {
          name: "Banco Fictício S.A.",
          document: "11222333000181",
          role: "credor",
          share: "",
        },
      ],
    }),
    ACTOR,
  );
  assert.equal(lien.seq, 5);
  const cancel = await createActWith(
    db,
    TENANT,
    id,
    actForm({
      kind: "AV",
      nature: "Cancelamento",
      effect: "cancelamento",
      cancelsActId: lien.id,
      parties: [],
    }),
    ACTOR,
  );
  await assert.rejects(
    createActWith(
      db,
      TENANT,
      id,
      actForm({
        kind: "AV",
        nature: "Cancelamento",
        effect: "cancelamento",
        cancelsActId: lien.id,
        parties: [],
      }),
      ACTOR,
    ),
    RiError,
  );
  let acervo = await loadAcervoWith(db, TENANT);
  let s = situationOf(acervo.acts.get(id) ?? []);
  assert.equal(s.burdens.length, 0);
  assert.deepEqual(
    s.owners.map((o) => o.name),
    ["Ana Fictícia"],
  );
  await setActDeletedWith(db, TENANT, cancel.id, true, ACTOR);
  acervo = await loadAcervoWith(db, TENANT);
  s = situationOf(acervo.acts.get(id) ?? []);
  assert.equal(s.burdens.length, 1);
  const again = await createActWith(
    db,
    TENANT,
    id,
    actForm({
      kind: "AV",
      nature: "Construção",
      effect: "descricao",
      parties: [],
    }),
    ACTOR,
  );
  assert.equal(again.seq, 7);
  const edited = await updateActWith(
    db,
    TENANT,
    first.id,
    actForm({
      parties: [
        {
          name: "Ana Fictícia",
          document: "11144477735",
          role: "adquirente",
          share: "50%",
        },
        {
          name: "Bruno Fictício",
          document: "52998224725",
          role: "adquirente",
          share: "50%",
        },
      ],
    }),
    ACTOR,
  );
  assert.equal(edited, 1);
  const [stored] = await db.select().from(riActs).limit(1);
  assert.ok(stored);
  acervo = await loadAcervoWith(db, TENANT);
  assert.equal(situationOf(acervo.acts.get(id) ?? []).owners.length, 2);
});

test("planilha: importa com proprietários e não repete o que já está no sistema", async () => {
  const csv = [
    "Matrícula;Situação;Proprietários;CPF/CNPJ;Denominação;Tipo",
    "20;Ativa;Carla Fictícia;390.533.447-05;Sítio Exemplo;Rural",
    "21;Encerrada;;;;Rural",
    "11;Ativa;Outra Pessoa;;Sítio;Rural",
  ].join("\n");
  const reading = readSheet(parseCsv(csv));
  const result = await importSheetWith(db, TENANT, reading.rows, ACTOR);
  assert.equal(result.created, 2);
  assert.equal(result.skipped.length, 1);
  const acervo = await loadAcervoWith(db, TENANT);
  const twenty = acervo.properties.find((p) => p.number === 20);
  assert.ok(twenty);
  const owners = situationOf(acervo.acts.get(twenty.id) ?? []).owners;
  assert.equal(owners[0]?.document, "39053344705");
});

test("cargas da ONR: geram, guardam, marcam importado e retiram", async () => {
  await assert.rejects(
    generateExportWith(db, OFFICE, "indicador-real", "completa", ACTOR),
    /código IBGE/,
  );
  await saveRiSettingsWith(db, TENANT, "2400000", ACTOR);
  const real = await generateExportWith(
    db,
    OFFICE,
    "indicador-real",
    "completa",
    ACTOR,
  );
  assert.ok(real.count >= 3);
  const lote = await generateExportWith(db, OFFICE, "cnm", "completa", ACTOR);
  const file = await exportFileWith(db, TENANT, lote.id);
  assert.match(file?.content ?? "", /<NUM>10<\/NUM><CNM>123456\.2\.0000010-/);
  await markExportImportedWith(db, TENANT, lote.id, true, ACTOR);
  const acervo = await loadAcervoWith(db, TENANT);
  const ten = acervo.properties.find((p) => p.number === 10);
  assert.equal(ten?.cnmInPgv, true);
  assert.match(ten?.cnm ?? "", /^123456\.2\.0000010-\d\d$/);
  // Every number of the lote is in the PGV now: nothing left to send.
  await assert.rejects(
    generateExportWith(db, OFFICE, "cnm", "completa", ACTOR),
    /nada para enviar/,
  );
  const people = await generateExportWith(
    db,
    OFFICE,
    "indicador-pessoal",
    "completa",
    ACTOR,
  );
  assert.ok(people.count >= 2);
  await withdrawExportWith(db, TENANT, people.id, ACTOR);
  assert.ok((await exportFileWith(db, TENANT, people.id))?.withdrawnAt);
  const actions = (await db.select().from(auditLog)).map((a) => a.action);
  for (const action of [
    "ri.property-create",
    "ri.property-edit",
    "ri.property-delete",
    "ri.act-create",
    "ri.act-delete",
    "ri.import",
    "ri.export",
    "ri.export-imported",
    "ri.export-delete",
    "ri.settings",
  ]) {
    assert.ok(actions.includes(action), action);
  }
});
