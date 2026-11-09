import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { emptyGuide } from "@/core/guides/schema.ts";
import { defaultGuideSettings } from "@/core/guides/settings.ts";
import { cartorioMarinho } from "@/core/tenant/tenants/marinho.ts";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  deleteGuideWith,
  findGuideWith,
  GuideNumberTakenError,
  issueGuideWith,
  listGuidesWith,
  renumberGuideWith,
  updateGuideWith,
} from "./tax-guides.ts";

let db: Database;
let close: () => Promise<void>;

before(async () => {
  ({ db, close } = await createTestDb());
});

after(async () => {
  await close();
});

const blank = emptyGuide(defaultGuideSettings(cartorioMarinho));
const guide = {
  ...blank,
  parties: blank.parties.map((party, index) => ({
    ...party,
    name: index ? "Maria Exemplo da Silva" : "João Fictício de Souza",
  })),
  property: { ...blank.property, description: "Rua Projetada, 10." },
  declaredValueCents: 2_700_000,
};

test("cada guia leva o próximo número do ano, e o ano novo recomeça em 1", async () => {
  const a = await issueGuideWith(
    db,
    "t-guias",
    guide,
    "u1",
    new Date("2026-03-10T12:00:00Z"),
  );
  const b = await issueGuideWith(
    db,
    "t-guias",
    guide,
    "u1",
    new Date("2026-03-11T12:00:00Z"),
  );
  const c = await issueGuideWith(
    db,
    "t-guias",
    guide,
    "u1",
    new Date("2027-01-05T12:00:00Z"),
  );
  const other = await issueGuideWith(
    db,
    "outra",
    guide,
    "u1",
    new Date("2026-03-11T12:00:00Z"),
  );
  assert.deepEqual([a.year, a.sequence], [2026, 1]);
  assert.deepEqual([b.year, b.sequence], [2026, 2]);
  assert.deepEqual([c.year, c.sequence], [2027, 1]);
  assert.deepEqual([other.year, other.sequence], [2026, 1]);
});

test("corrigir mantém o número; outra serventia não vê nem corrige", async () => {
  const issued = await issueGuideWith(db, "t-corrige", guide, "u1");
  const fixed = await updateGuideWith(
    db,
    "t-corrige",
    issued.id,
    { ...guide, nature: "permuta" },
    "u1",
  );
  assert.equal(fixed?.sequence, issued.sequence);
  assert.equal(
    (await findGuideWith(db, "t-corrige", issued.id))?.guide.nature,
    "permuta",
  );
  assert.equal(await findGuideWith(db, "outra", issued.id), undefined);
  assert.equal(
    await updateGuideWith(db, "outra", issued.id, guide, "u1"),
    undefined,
  );
  assert.equal((await listGuidesWith(db, "t-corrige")).length, 1);
});

test("número à mão: recusa repetido; excluir libera o número sem apagar", async () => {
  const at = new Date("2026-05-01T12:00:00Z");
  const one = await issueGuideWith(db, "t-num", guide, "u1", at);
  const two = await issueGuideWith(db, "t-num", guide, "u1", at);
  await assert.rejects(
    renumberGuideWith(db, "t-num", two.id, 2026, one.sequence, "u1"),
    GuideNumberTakenError,
  );
  const moved = await renumberGuideWith(db, "t-num", two.id, 2026, 10, "u1");
  assert.equal(moved?.sequence, 10);

  assert.equal(await deleteGuideWith(db, "t-num", one.id, "u1"), true);
  assert.equal(await findGuideWith(db, "t-num", one.id), undefined);
  assert.deepEqual(
    (await listGuidesWith(db, "t-num")).map((g) => g.sequence),
    [10],
  );
  // The deleted guia's number is free again for a live one.
  const back = await renumberGuideWith(
    db,
    "t-num",
    two.id,
    2026,
    one.sequence,
    "u1",
  );
  assert.equal(back?.sequence, one.sequence);
  // And the next number follows the highest live one.
  const next = await issueGuideWith(db, "t-num", guide, "u1", at);
  assert.equal(next.sequence, one.sequence + 1);
  assert.equal(await deleteGuideWith(db, "outra", next.id, "u1"), false);
});
