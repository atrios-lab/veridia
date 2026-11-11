import assert from "node:assert/strict";
import { test } from "node:test";
import { bookDuties, februaryVisto, interimSplit } from "./deadlines.ts";

test("visto: 15º dia útil de fevereiro, com o Carnaval contado", () => {
  // 2027: Carnaval em 08 e 09/02, Cinzas 10/02.
  const day = februaryVisto(2027);
  assert.ok(day >= "2027-02-19" && day <= "2027-02-26", day);
  assert.equal(new Date(`${day}T12:00:00Z`).getUTCDay() % 6 === 0, false);
});

test("janeiro: balanço até 15/01 e, gerado, o envio em 5 dias", () => {
  const before = bookDuties("2027-01-05", { lastYearBalanceOn: null });
  assert.deepEqual(
    before.map((d) => d.id),
    ["balanco"],
  );
  assert.match(before[0]?.title ?? "", /2026/);
  assert.equal(before[0]?.late, false);
  const late = bookDuties("2027-01-20", { lastYearBalanceOn: null });
  assert.equal(late.find((d) => d.id === "balanco")?.late, true);
  assert.ok(late.some((d) => d.id === "visto"));
  const sent = bookDuties("2027-01-14", { lastYearBalanceOn: "2027-01-12" });
  assert.deepEqual(
    sent.map((d) => [d.id, d.due]),
    [["remessa", "2027-01-17"]],
  );
  assert.deepEqual(bookDuties("2027-06-10", { lastYearBalanceOn: null }), []);
});

test("interino: FDJ até o dia 10 e contas até o dia 20", () => {
  const ids = (t: string) =>
    bookDuties(t, { lastYearBalanceOn: "2026-01-10", interim: true }).map(
      (d) => d.id,
    );
  assert.deepEqual(ids("2026-06-05"), ["interino-fdj", "interino-contas"]);
  assert.deepEqual(ids("2026-06-15"), ["interino-contas"]);
  assert.deepEqual(ids("2026-06-25"), []);
});

test("teto do interino: até o teto é remuneração, o resto vai ao FDJ", () => {
  assert.deepEqual(interimSplit(4_000_000, 3_000_000), {
    payCents: 3_000_000,
    excessCents: 1_000_000,
  });
  assert.deepEqual(interimSplit(2_000_000, 3_000_000), {
    payCents: 2_000_000,
    excessCents: 0,
  });
  assert.deepEqual(interimSplit(-500, 3_000_000), {
    payCents: 0,
    excessCents: 0,
  });
});
