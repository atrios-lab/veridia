import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { EMPTY_AUX } from "@/core/ri/auxiliary.ts";
import { fromUtm } from "@/core/ri/geo.ts";
import { EMPTY_CONDO, EMPTY_RURAL } from "@/core/ri/property.ts";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import { createPropertyWith } from "./ri.ts";
import {
  addGeometryWith,
  currentGeometriesWith,
  overlapsOf,
  readGeometrySource,
  setGeometryDeletedWith,
} from "./ri-geo.ts";

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

// Fictitious data only (LGPD).
const TENANT = "cartorio-teste-ri-mapa";
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
  location: 1,
  propertyKind: 9,
  streetKind: 177,
  street: "Sítio Exemplo",
  streetNumber: "",
  district: "Zona Rural",
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
  area: "1 ha",
  auxKind: "",
  linkedNumbers: "",
  priorActs: 0,
  aux: { ...EMPTY_AUX, parties: [] },
  description: "",
  notes: "",
};

const square = (e0: number, n0: number, side: number) =>
  [
    [e0, n0],
    [e0 + side, n0],
    [e0 + side, n0 + side],
    [e0, n0 + side],
  ].map(([e, n], i) => ({
    code: `P${i + 1}`,
    ...fromUtm(e as number, n as number, 25),
  }));

test("perímetro lido, guardado, sobreposição achada, apagar só marca", async () => {
  const a = await createPropertyWith(db, TENANT, { ...base, number: 1 }, ACTOR);
  const b = await createPropertyWith(db, TENANT, { ...base, number: 2 }, ACTOR);
  const memorial = `Fuso 25. Vértice P1, de coordenadas N 9.350.000,00m e E 250.000,00m; vértice P2, de coordenadas N 9.350.000,00m e E 250.100,00m; vértice P3, de coordenadas N 9.350.100,00m e E 250.100,00m; vértice P4, de coordenadas N 9.350.100,00m e E 250.000,00m.`;
  const reading = await readGeometrySource({ text: memorial });
  assert.equal(reading.source, "memorial");
  assert.equal(reading.vertices.length, 4);
  await addGeometryWith(
    db,
    TENANT,
    a,
    { ...reading, notes: reading.notes.join(" ") },
    ACTOR,
  );
  // B overlaps A by 50 m × 100 m.
  const gB = await addGeometryWith(
    db,
    TENANT,
    b,
    {
      vertices: square(250050, 9350000, 100),
      source: "manual",
      sourceText: "",
    },
    ACTOR,
  );
  let rows = await currentGeometriesWith(db, TENANT);
  assert.equal(rows.length, 2);
  const [overlap] = overlapsOf(rows);
  assert.ok(overlap);
  assert.ok(
    Math.abs((overlap?.areaM2 ?? 0) - 5000) < 5,
    String(overlap?.areaM2),
  );
  await setGeometryDeletedWith(db, TENANT, gB, true, ACTOR);
  rows = await currentGeometriesWith(db, TENANT);
  assert.equal(rows.length, 1);
  assert.deepEqual(overlapsOf(rows), []);
  await assert.rejects(
    addGeometryWith(
      db,
      TENANT,
      a,
      {
        vertices: square(1, 1, 1).slice(0, 2),
        source: "manual",
        sourceText: "",
      },
      ACTOR,
    ),
    /3 vértices/,
  );
});

test("tabela colada (vértice; longitude; latitude)", async () => {
  const pts = square(260000, 9360000, 50);
  const text = [
    "Vértice;Longitude;Latitude",
    ...pts.map((p) => `${p.code};${p.lon};${p.lat}`),
  ].join("\n");
  const reading = await readGeometrySource({ text });
  assert.equal(reading.source, "sigef");
  assert.equal(reading.vertices.length, 4);
});
