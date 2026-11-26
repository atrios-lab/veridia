import assert from "node:assert/strict";
import { test } from "node:test";
import {
  areaCheck,
  fromUtm,
  geoJsonOf,
  parseAngle,
  plantaSvg,
  readMemorial,
  readVertexTable,
  shapeOf,
  toUtm,
  zoneOf,
} from "./geo.ts";

// A fictitious square of 100 m × 100 m in fuso 25 S (coordinates made up).
const E0 = 250000;
const N0 = 9350000;
const square = [
  ["P1", E0, N0],
  ["P2", E0 + 100, N0],
  ["P3", E0 + 100, N0 + 100],
  ["P4", E0, N0 + 100],
] as const;

test("UTM ida e volta e fuso", () => {
  const g = fromUtm(E0, N0, 25);
  const back = toUtm(g.lat, g.lon, 25);
  assert.ok(Math.abs(back.e - E0) < 0.01);
  assert.ok(Math.abs(back.n - N0) < 0.01);
  assert.equal(zoneOf(-35.2), 25);
  assert.equal(zoneOf(-37.5), 24);
});

test("ângulos em graus, minutos e segundos", () => {
  assert.ok(Math.abs(parseAngle("-36°12'34,567\"") - -36.2096) < 0.0001);
  assert.ok(Math.abs(parseAngle("5° 45' 12.5\" S") - -5.7535) < 0.0001);
  assert.equal(parseAngle("-35,25"), -35.25);
});

test("memorial em UTM: área, perímetro e fechamento", () => {
  const text = `Fuso 25. Inicia-se no vértice ${square
    .map(
      ([c, e, n]) =>
        `${c}, de coordenadas N ${n.toLocaleString("pt-BR")},00m e E ${e.toLocaleString("pt-BR")},00m; segue até o vértice`,
    )
    .join(" ")} P1, ponto inicial.`;
  const reading = readMemorial(text);
  assert.equal(reading.vertices.length, 4);
  const shape = shapeOf(reading.vertices);
  assert.ok(Math.abs(shape.areaM2 - 10000) < 1, String(shape.areaM2));
  assert.ok(Math.abs(shape.perimeterM - 400) < 0.1);
  assert.deepEqual(shape.problems, []);
  assert.equal(shape.sides[0]?.azimuth.toFixed(0), "90");
  assert.match(plantaSvg(shape, { title: "Matrícula 1" }), /<polygon/);
  assert.match(
    geoJsonOf([{ id: "x", label: "1", vertices: reading.vertices }]),
    /"Polygon"/,
  );
  assert.equal(areaCheck("1,0000 ha", shape.areaM2)?.ok, true);
  assert.equal(areaCheck("2 ha", shape.areaM2)?.ok, false);
});

test("planilha do Sigef em geográficas e lados que se cruzam", () => {
  const g = square.map(([c, e, n]) => ({ c, ...fromUtm(e, n, 25) }));
  const rows = [
    ["Código", "Longitude", "Sigma", "Latitude", "Sigma"],
    ...g.map((v) => [v.c, String(v.lon), "0,1", String(v.lat), "0,1"]),
  ];
  const reading = readVertexTable(rows);
  assert.equal(reading.vertices.length, 4);
  assert.ok(Math.abs(shapeOf(reading.vertices).areaM2 - 10000) < 1);
  const crossed = [
    reading.vertices[0],
    reading.vertices[2],
    reading.vertices[1],
    reading.vertices[3],
  ].filter((v): v is NonNullable<typeof v> => Boolean(v));
  assert.ok(shapeOf(crossed).problems.some((p) => /se cruzam/.test(p)));
});
