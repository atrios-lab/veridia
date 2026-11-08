import assert from "node:assert/strict";
import { test } from "node:test";
import { groupBulletinsByYear, groupDocumentsByCategory } from "./listing.ts";

function bulletin(referenceMonth: string, status = "consolidated") {
  return { id: referenceMonth, referenceMonth, status };
}

test("bulletins group by year, newest year first, twelve slots each", () => {
  const years = groupBulletinsByYear([
    bulletin("2026-02"),
    bulletin("2026-01"),
    bulletin("2025-12"),
  ]);
  assert.deepEqual(
    years.map((y) => y.year),
    [2026, 2025],
  );
  for (const y of years) assert.equal(y.months.length, 12);
});

test("a month keeps its slot and an unpublished month stays null", () => {
  const [y2026] = groupBulletinsByYear([
    bulletin("2026-08", "preliminary"),
    bulletin("2026-01"),
  ]);
  assert.equal(y2026.count, 2);
  assert.equal(y2026.months[0]?.id, "2026-01");
  assert.equal(y2026.months[7]?.id, "2026-08");
  assert.equal(y2026.months[7]?.status, "preliminary");
  assert.equal(y2026.months[1], null);
  assert.equal(y2026.months[11], null);
});

test("a full year counts twelve", () => {
  const rows = Array.from({ length: 12 }, (_, i) =>
    bulletin(`2025-${String(i + 1).padStart(2, "0")}`),
  );
  const [y2025] = groupBulletinsByYear(rows);
  assert.equal(y2025.count, 12);
  assert.ok(y2025.months.every((m) => m !== null));
});

test("no bulletins, no years", () => {
  assert.deepEqual(groupBulletinsByYear([]), []);
});

test("a malformed reference month is skipped, not placed", () => {
  const years = groupBulletinsByYear([bulletin("2026-13"), bulletin("x")]);
  assert.deepEqual(years, []);
});

function doc(title: string, category: string) {
  return { id: title, title, category };
}

test("a fee table puts the first edition up front and folds the rest", () => {
  const [group] = groupDocumentsByCategory([
    doc("Custas 2026", "Tabela de custas"),
    doc("Custas 2025", "Tabela de custas"),
    doc("Custas 2024", "Tabela de custas"),
  ]);
  assert.equal(group.category, "Tabela de custas");
  assert.deepEqual(
    group.current.map((d) => d.title),
    ["Custas 2026"],
  );
  assert.deepEqual(
    group.previous.map((d) => d.title),
    ["Custas 2025", "Custas 2024"],
  );
});

test("two notices are two documents, not two versions", () => {
  const [group] = groupDocumentsByCategory([
    doc("Aviso A", "Aviso"),
    doc("Aviso B", "Aviso"),
  ]);
  assert.equal(group.current.length, 2);
  assert.equal(group.previous.length, 0);
});

test("groups follow the panel order of each category's first document", () => {
  const groups = groupDocumentsByCategory([
    doc("Emolumentos 2026", "Tabela de emolumentos"),
    doc("Custas 2026", "Tabela de custas"),
    doc("Emolumentos 2025", "Tabela de emolumentos"),
    doc("Cartaz", "Cartaz de gratuidade e isenção"),
  ]);
  assert.deepEqual(
    groups.map((g) => g.category),
    [
      "Tabela de emolumentos",
      "Tabela de custas",
      "Cartaz de gratuidade e isenção",
    ],
  );
  assert.deepEqual(
    groups[0].previous.map((d) => d.title),
    ["Emolumentos 2025"],
  );
});

test("a category outside the fixed list still gets its own group", () => {
  const groups = groupDocumentsByCategory([
    doc("Antigo", "Categoria antiga"),
    doc("Antigo 2", "Categoria antiga"),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].category, "Categoria antiga");
  assert.equal(groups[0].current.length, 2);
});
