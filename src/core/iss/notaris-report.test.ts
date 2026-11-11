import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeReports, parseNotarisReport } from "./notaris-report.ts";

// Fictitious figures, in the reports' layout (LGPD: no office data here).
const PRODUTIVIDADE = `RELATÓRIO DE PRODUTIVIDADE (REGISTRADO E PAGO NO DIA)
De: 01/09/2026 até 30/09/2026 CARTÓRIO EXEMPLO FULANO DE TAL
Ato Qte. Emol. Desc. Emol. FDJ FRMP FCRCPN FPGE Desc. Custas ISSQN Total Bruto Total Líq.
1000001 - Ato fictício 10 1.000,00 0,00 250,00 75,00 80,00 12,50 0,00 45,00 1.462,50 1.462,50
TOTAL 120 2.000,00 0,00 500,00 150,00 160,00 25,00 0,00 90,00 2.925,00 2.925,00
Atos Praticados [A] Arrec. Bruta (Emolumentos) [B] Arrec. Líq. Emol. (A - Tot. Desc. Emol.) [C] Custeio (Tot. Desp.) [D] Repasses (Tot. Fundos) [E] Arrec. Tot. Bruta (A + D + Tot. ISSQN) Arrec. Tot. Liq.
120 R$2.000,00 R$2.000,00 R$7.500,00 R$835,00 R$2.925,00 R$2.925,00 Page 2 of 2`;

const TRIBUTOS = `Valores Tributários no Período De: 01/09/2026 até 30/09/2026
Ato Qte. Emol. Desc. Emol. Total Líq. ISSQN 5,00%
1000001 - Ato fictício 10 1.000,00 0,00 50,00 0,00
TOTAL 120 2.000,00 0,00 0,00 90,00 Page 1 of 1`;

test("relatório de produtividade: atos, emolumentos, fundos, ISS, custeio e arrecadação", () => {
  const read = parseNotarisReport(PRODUTIVIDADE);
  assert.equal(read.kind, "produtividade");
  assert.equal(read.competence, "2026-09");
  assert.equal(read.actsCount, 120);
  assert.equal(read.emolumentsCents, 200_000);
  assert.deepEqual(read.funds, {
    fdj: 50_000,
    frmp: 15_000,
    fcrcpn: 16_000,
    funaf: 2_500,
  });
  assert.equal(read.issCents, 9_000);
  assert.equal(read.expensesCents, 750_000);
  assert.equal(read.grossRevenueCents, 292_500);
});

test("valores tributários: ISS ato a ato e a alíquota do cabeçalho", () => {
  const read = parseNotarisReport(TRIBUTOS);
  assert.equal(read.kind, "tributos");
  assert.equal(read.competence, "2026-09");
  assert.equal(read.emolumentsCents, 200_000);
  assert.equal(read.issCents, 9_000);
  assert.equal(read.rateBasisPoints, 500);
});

test("os dois juntos se completam; texto estranho não inventa nada", () => {
  const both = mergeReports([
    parseNotarisReport(TRIBUTOS),
    parseNotarisReport(PRODUTIVIDADE),
  ]);
  assert.equal(both.rateBasisPoints, 500);
  assert.equal(both.expensesCents, 750_000);
  assert.deepEqual(parseNotarisReport("um PDF qualquer"), {
    kind: "desconhecido",
  });
});
