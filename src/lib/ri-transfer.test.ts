import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { situationOf } from "@/core/ri/acts.ts";
import { EMPTY_AUX } from "@/core/ri/auxiliary.ts";
import { EMPTY_CONDO, EMPTY_RURAL } from "@/core/ri/property.ts";
import { transferFromJson, transferFromTable } from "@/core/ri/transfer.ts";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import { createActWith, createPropertyWith, loadAcervoWith } from "./ri.ts";
import { transferFile } from "./ri-sheet.ts";
import {
  applyTransferWith,
  previewTransferWith,
  transferExportWith,
  transferTablesWith,
} from "./ri-transfer.ts";

let db: Database;
let close: () => Promise<void>;
after(async () => {
  await close();
});

// Fictitious data only (LGPD).
const FROM = "cartorio-teste-ri-exporta";
const TO = "cartorio-teste-ri-importa";
const ACTOR = { id: "u-oficial" };

const base = {
  book: 2 as const,
  recordKind: 1,
  status: 0,
  cnm: "",
  cnmInPgv: false,
  openedOn: "2001-01-01",
  origin: "",
  ficha: "",
  location: 0,
  propertyKind: 1,
  streetKind: 250,
  street: "das Flores",
  streetNumber: "10",
  district: "Centro",
  cep: "",
  complement: "",
  quadra: "",
  setor: "",
  conjunto: "",
  lote: "",
  loteamento: "",
  contributors: [],
  rural: { ...EMPTY_RURAL },
  condo: { ...EMPTY_CONDO },
  area: "",
  auxKind: "",
  linkedNumbers: "",
  priorActs: 0,
  aux: { ...EMPTY_AUX, parties: [] },
  description: "",
  notes: "",
};

before(async () => {
  ({ db, close } = await createTestDb());
  const id = await createPropertyWith(
    db,
    FROM,
    { ...base, number: 10 },
    ACTOR,
    { owners: [{ name: "ANA FICTÍCIA", document: "11144477735" }] },
  );
  await createActWith(
    db,
    FROM,
    id,
    {
      kind: "R",
      effect: "transmissao",
      nature: "Compra e venda",
      registeredOn: "2010-05-05",
      summary: "Venda fictícia.",
      cancelsActId: null,
      protocol: "55",
      seal: "SELO-FICTICIO-9",
      valueCents: 5000000,
      parties: [
        {
          name: "BRUNO FICTÍCIO",
          document: "52998224725",
          role: "adquirente",
          share: "",
        },
        {
          name: "ANA FICTÍCIA",
          document: "11144477735",
          role: "transmitente",
          share: "",
        },
      ],
    },
    ACTOR,
  );
  await createPropertyWith(
    db,
    FROM,
    { ...base, number: 3, book: 3, auxKind: "Convenção de condomínio" },
    ACTOR,
  );
});

test("cópia do acervo (JSON) leva matrículas, atos e pessoas para outro cartório", async () => {
  const file = await transferExportWith(db, FROM, "acervo", "json", ACTOR);
  const read = await transferFile({ name: file.name, bytes: file.bytes });
  assert.equal(read.type, "json");
  const transfer = transferFromJson(read.type === "json" ? read.value : null);
  const preview = await previewTransferWith(db, TO, transfer);
  assert.equal(preview.properties.new, 2);
  assert.equal(preview.acts.new, 2);
  const result = await applyTransferWith(
    db,
    TO,
    transfer,
    { complete: false },
    ACTOR,
  );
  assert.equal(result.properties, 2);
  assert.equal(result.acts, 2);
  const acervo = await loadAcervoWith(db, TO);
  const m10 = acervo.properties.find((p) => p.number === 10);
  assert.ok(m10);
  const acts = acervo.acts.get(m10.id) ?? [];
  assert.deepEqual(
    acts.map((a) => `${a.kind}-${a.seq}`),
    ["M-0", "R-1"],
  );
  assert.equal(acts[1]?.seal, "SELO-FICTICIO-9");
  assert.equal(acts[1]?.valueCents, 5000000);
  // The migração keeps who owned it then; the R-1 makes the owner of now.
  assert.deepEqual(
    acts[0]?.parties.map((p) => p.document),
    ["11144477735"],
  );
  assert.deepEqual(
    situationOf(acts).owners.map((o) => o.document),
    ["52998224725"],
  );
  assert.equal(
    acervo.properties.find((p) => p.book === 3)?.auxKind,
    "Convenção de condomínio",
  );

  // The same file again: nothing new comes in, nothing changes.
  const again = await applyTransferWith(
    db,
    TO,
    transfer,
    { complete: true },
    ACTOR,
  );
  assert.equal(again.properties + again.acts + again.completed, 0);
  assert.ok(again.skipped.some((s) => /já está lançado/.test(s.reason)));
});

test("planilha .xlsx de matrículas: ida e volta, e completar só o vazio", async () => {
  const xlsx = await transferExportWith(
    db,
    FROM,
    "matriculas",
    "xlsx",
    ACTOR,
    2,
  );
  const read = await transferFile({ name: xlsx.name, bytes: xlsx.bytes });
  assert.equal(read.type, "table");
  const rows = read.type === "table" ? read.rows : [];
  assert.equal(rows[1]?.[1], "10");
  // The office adds a new matrícula to the sheet and fills a CEP.
  const header = rows[0] ?? [];
  const cep = header.indexOf("CEP");
  const changed = rows.map((r) => [...r]);
  (changed[1] as string[])[cep] = "59000-000";
  const extra = header.map(() => "");
  extra[header.indexOf("Livro")] = "2";
  extra[header.indexOf("Matrícula")] = "11";
  extra[header.indexOf("Logradouro")] = "Nova";
  changed.push(extra);
  const transfer = transferFromTable(
    changed,
    read.type === "table" ? read.label : "",
  );
  const result = await applyTransferWith(
    db,
    TO,
    transfer,
    { complete: true },
    ACTOR,
  );
  assert.equal(result.properties, 1);
  assert.equal(result.completed, 1);
  const acervo = await loadAcervoWith(db, TO);
  assert.equal(acervo.properties.find((p) => p.number === 10)?.cep, "59000000");
  assert.equal(
    acervo.properties.find((p) => p.number === 10)?.street,
    "das Flores",
  );
});

test("tabelas de exportação: atos, pessoas e indicadores", async () => {
  const tables = await transferTablesWith(db, FROM);
  assert.equal(tables.atos.length, 3);
  assert.ok(tables.pessoas.some((r) => r[0] === "BRUNO FICTÍCIO"));
  assert.equal(tables["indicador-real"].length, 2);
  assert.ok(
    tables["indicador-pessoal"].some(
      (r) => r[0] === "ANA FICTÍCIA" && r[3] === "VENDA",
    ),
  );
  const csv = await transferExportWith(db, FROM, "atos", "csv", ACTOR);
  assert.deepEqual([...csv.bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
});

test("Livro 3: as partes do registro entram no cadastro de pessoas", async () => {
  const TENANT = "cartorio-teste-ri-livro3";
  await createPropertyWith(
    db,
    TENANT,
    {
      ...base,
      book: 3,
      number: 9,
      auxKind: "Convenção antenupcial (pacto antenupcial)",
      aux: {
        ...EMPTY_AUX,
        regime: "separação total de bens",
        parties: [
          { name: "CARLA FICTÍCIA", document: "39053344705", role: "conjuge" },
          { name: "DAVI FICTÍCIO", document: "", role: "conjuge" },
        ],
      },
    },
    ACTOR,
  );
  const acervo = await loadAcervoWith(db, TENANT);
  const names = [...acervo.people.values()].map((p) => p.name).sort();
  assert.deepEqual(names, ["CARLA FICTÍCIA", "DAVI FICTÍCIO"]);
  assert.equal(acervo.properties[0]?.aux.regime, "separação total de bens");
});
