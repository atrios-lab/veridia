import assert from "node:assert/strict";
import { test } from "node:test";
import type { Tenant } from "../tenant/schema.ts";
import {
  buildExcessDocument,
  ceilingOf,
  computeExcess,
  monthsBetween,
} from "./excess.ts";

// The "!" examples: a fictitious STF pay of R$ 40.000,00.
const SUBSIDY = 4_000_000;
const month = (revenueCents: number, expensesCents: number) =>
  computeExcess({
    period: "mensal",
    start: "2026-01-01",
    end: "2026-01-31",
    subsidyCents: SUBSIDY,
    revenueCents,
    expensesCents,
  });

test("teto: 90,25% do subsídio", () => {
  assert.equal(ceilingOf(SUBSIDY), 3_610_000);
  assert.equal(ceilingOf(4_636_619), 4_184_549);
  assert.equal(monthsBetween("2026-10-01", "2026-12-31"), 3);
  assert.equal(monthsBetween("2026-12-01", "2027-02-28"), 3);
});

test("exemplo 1: mês acima do teto", () => {
  const r = month(8_000_000, 3_000_000);
  assert.equal(r.netCents, 5_000_000);
  assert.equal(r.excessCents, 1_390_000);
  assert.equal(r.interimPayCents, 3_610_000);
});

test("exemplo 2: mês abaixo do teto", () => {
  const r = month(5_000_000, 2_500_000);
  assert.equal(r.excessCents, 0);
  assert.equal(r.interimPayCents, 2_500_000);
});

test("exemplo 3: o trimestre soma os três meses", () => {
  const r = computeExcess({
    period: "trimestral",
    start: "2026-01-01",
    end: "2026-03-31",
    subsidyCents: SUBSIDY,
    revenueCents: 10_500_000,
    expensesCents: 0,
  });
  assert.equal(r.limitCents, 10_830_000);
  assert.equal(r.excessCents, 0);
  // Month by month, March alone would go over.
  assert.equal(month(6_000_000, 0).excessCents, 2_390_000);
});

test("exemplo 4: mês com prejuízo", () => {
  const r = month(2_000_000, 2_600_000);
  assert.equal(r.netCents, -600_000);
  assert.equal(r.excessCents, 0);
  assert.equal(r.interimPayCents, 0);
});

test("memória de cálculo: os passos e o resultado", () => {
  const tenant = {
    officialName: "Cartório Fictício de Exemplo",
    subtitle: "Notas e Registros",
    cns: "00.000-0",
    location: { city: "Cidade Exemplo", state: "RN" },
    owner: { name: "Maria Exemplo" },
    legalFooter: "Rodapé fictício",
  } as unknown as Tenant;
  const doc = buildExcessDocument(
    tenant,
    {
      id: "x",
      period: "mensal",
      start: "2026-01-01",
      end: "2026-01-31",
      subsidyCents: SUBSIDY,
      revenueCents: 8_000_000,
      expensesCents: 3_000_000,
      notes: "Teste fictício",
      createdAt: "2026-02-02T12:00:00.000Z",
      createdBy: "titular",
    },
    "2026-02-02",
  );
  const text = JSON.stringify(doc);
  assert.match(text, /Teto do mês: 90,25% de 4/);
  assert.match(text, /R\$ 36\.100,00/);
  assert.match(
    text,
    /Excedente a depositar \(3 - 6, se positivo\)","value":"R\$ 13\.900,00/,
  );
  assert.match(text, /art\. 194, I/);
  assert.match(text, /Teste fictício/);
  assert.equal(doc.signee, "Maria Exemplo");
});
