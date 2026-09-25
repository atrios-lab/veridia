import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bulletinBalanceCents,
  bulletinPeriod,
  bulletinTaxesCents,
  bulletinView,
  fundFieldName,
  issLabel,
  parseBulletinFigures,
  formatMoneyBRL,
  formatMonthYear,
  parseCount,
  parseMoneyBRL,
} from "./bulletin.ts";

const RN_FUNDS = { fdj: 123_456, frmp: 32_100, fcrcpn: 21_040, funaf: 9_810 };

const TYPED = {
  actsCount: "267",
  funds: { fdj: "1.234,56", frmp: "321,00", fcrcpn: "210,40", funaf: "98,10" },
  iss: "612,00",
  grossRevenue: "7.978,12",
  expenses: "8.069,31",
};

function typed(overrides: Partial<typeof TYPED> = {}): typeof TYPED {
  return { ...TYPED, ...overrides };
}

test("the balance is the office's own January, to the centavo", () => {
  // 7.978,12 − 2.652,59 − 8.069,31 = −2.743,78: the quadro an office already
  // publishes, with its taxes now split into funds and ISS that sum to the
  // same 2.652,59.
  const figures = {
    actsCount: 267,
    fundAmountsCents: { fdj: 150_000, frmp: 40_000, fcrcpn: 30_000, funaf: 10_000 },
    issCents: 35_259,
    grossRevenueCents: 797_812,
    expensesCents: 806_931,
  };
  assert.equal(bulletinTaxesCents(figures), 265_259);
  const cents = bulletinBalanceCents(figures);
  assert.equal(cents, -274_378);
  assert.equal(formatMoneyBRL(cents ?? 0), "-2.743,78");
});

test("no balance without both private figures", () => {
  assert.equal(
    bulletinBalanceCents({
      actsCount: 1,
      fundAmountsCents: RN_FUNDS,
      issCents: 0,
      grossRevenueCents: null,
      expensesCents: null,
    }),
    null,
  );
});

test("parseBulletinFigures reads every fund, the ISS and the private figures", () => {
  const parsed = parseBulletinFigures("RN", typed(), { privateFigures: true });
  assert.ok("figures" in parsed);
  assert.deepEqual(parsed.figures, {
    actsCount: 267,
    fundAmountsCents: RN_FUNDS,
    issCents: 61_200,
    grossRevenueCents: 797_812,
    expensesCents: 806_931,
  });
});

test("zero is a typed value; a blank fund is an error on that field", () => {
  const zero = parseBulletinFigures(
    "RN",
    typed({ funds: { fdj: "0", frmp: "0,00", fcrcpn: "0", funaf: "0,00" } }),
    { privateFigures: false },
  );
  assert.ok("figures" in zero);
  assert.equal(zero.figures.fundAmountsCents.funaf, 0);

  const blank = parseBulletinFigures(
    "RN",
    typed({ funds: { fdj: "1,00", frmp: "", fcrcpn: "1,00", funaf: "1,00" } }),
    { privateFigures: false },
  );
  assert.ok("fieldErrors" in blank);
  assert.deepEqual(Object.keys(blank.fieldErrors), [fundFieldName("frmp")]);
});

test("with the option off, gross revenue and expenses are ignored, not required", () => {
  const parsed = parseBulletinFigures(
    "RN",
    typed({ grossRevenue: "", expenses: "lixo" }),
    { privateFigures: false },
  );
  assert.ok("figures" in parsed);
  assert.equal(parsed.figures.grossRevenueCents, null);
  assert.equal(parsed.figures.expensesCents, null);
});

test("with the option on, gross revenue and expenses are required", () => {
  const parsed = parseBulletinFigures("RN", typed({ grossRevenue: "" }), {
    privateFigures: true,
  });
  assert.ok("fieldErrors" in parsed);
  assert.deepEqual(Object.keys(parsed.fieldErrors), ["grossRevenue"]);
});

test("the view drops the private block when the option is off or a figure is missing", () => {
  const figures = {
    actsCount: 267,
    fundAmountsCents: RN_FUNDS,
    issCents: 61_200,
    grossRevenueCents: 797_812,
    expensesCents: 806_931,
  };
  const on = bulletinView("RN", figures, true);
  assert.ok(on.privateFigures);
  assert.equal(on.privateFigures.taxesCents, 186_406 + 61_200);
  assert.equal(on.fundsTotalCents, 186_406);

  assert.equal(bulletinView("RN", figures, false).privateFigures, null);
  assert.equal(
    bulletinView("RN", { ...figures, expensesCents: null }, true).privateFigures,
    null,
  );
});

test("the ISS line names the municipality", () => {
  assert.equal(issLabel("Canguaretama"), "ISS, tributo municipal (Canguaretama)");
});

test("parseMoneyBRL reads the pt-BR the operator types", () => {
  assert.equal(parseMoneyBRL("48.230,10"), 4_823_010);
  assert.equal(parseMoneyBRL("48230,10"), 4_823_010);
  assert.equal(parseMoneyBRL("48230.10"), 4_823_010);
  assert.equal(parseMoneyBRL("R$ 48.230,10"), 4_823_010);
  assert.equal(parseMoneyBRL("1.000"), 100_000);
  assert.equal(parseMoneyBRL("5"), 500);
  assert.equal(parseMoneyBRL("0,05"), 5);
  assert.equal(parseMoneyBRL("9.612,44"), 961_244);
});

test("parseMoneyBRL refuses what is not money", () => {
  assert.equal(parseMoneyBRL(""), null);
  assert.equal(parseMoneyBRL("abc"), null);
  assert.equal(parseMoneyBRL("1,234"), null); // three decimals
  assert.equal(parseMoneyBRL("1,2,3"), null);
  assert.equal(parseMoneyBRL("-5"), null); // a value, not a sign, is typed
});

test("parseMoneyBRL survives a round trip through formatMoneyBRL", () => {
  for (const cents of [0, 5, 100, 961_244, 4_823_010, 100_000_00]) {
    const round = parseMoneyBRL(formatMoneyBRL(cents));
    assert.equal(round, cents, `round-trip ${cents}`);
  }
});

test("parseCount takes a whole count, nothing else", () => {
  assert.equal(parseCount("412"), 412);
  assert.equal(parseCount("0"), 0);
  assert.equal(parseCount("4,12"), null);
  assert.equal(parseCount("-1"), null);
  assert.equal(parseCount(""), null);
});

test("formatMonthYear and bulletinPeriod read in pt-BR", () => {
  assert.equal(formatMonthYear(8, 2026), "Agosto de 2026");
  assert.equal(bulletinPeriod(8, 2026), "01/08 a 31/08/2026");
  // February in a non-leap year ends on the 28th.
  assert.equal(bulletinPeriod(2, 2026), "01/02 a 28/02/2026");
});
