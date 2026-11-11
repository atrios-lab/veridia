import assert from "node:assert/strict";
import { test } from "node:test";
import type { Tenant } from "../tenant/schema.ts";
import {
  type BookEntry,
  bookCsv,
  buildAnnualDocument,
  buildBookDocument,
  categoryLabel,
  DEFAULT_SPECIALTIES,
  lateExpense,
  looksPersonal,
  specialtyOf,
  summarize,
} from "./book.ts";
import { parseProductivity, parseReceipt } from "./reports.ts";

// A fictitious productivity report, in the layout the panel extracts.
const PRODUCTIVITY = [
  "Page 1 of 1",
  "CARTÓRIO FICTÍCIO DE EXEMPLO/RN 05/10/2026 10:00:00",
  "RELATÓRIO DE PRODUTIVIDADE",
  "(REGISTRADO E PAGO NO DIA)",
  "De: 05/10/2026 até 05/10/2026",
  "Desc. Desc. Total",
  "Ato Qte. Emol. FDJ FRMP FCRCPN FPGE ISSQN Total Líq.",
  "Emol. Custas Bruto",
  "2200556 - Procuração simples ou",
  "substabelecimento - Até 2 2 126,06 0,00 39,88 11,64 13,30 1,14 0,00 6,30 198,32 198,32",
  "outorgantes.",
  "2200569 - Reconhecimento de",
  "10 42,10 0,00 0,00 0,00 0,00 0,00 0,00 2,10 44,20 44,20",
  "firma",
  "- 3 0,00 0,00 0,00 0,00 0,00 0,00 0,00 0,00 0,00 0,00",
  "2300107 - Pedidos de retificação",
  "1 63,03 0,00 22,78 6,64 7,59 1,15 0,00 3,15 104,34 104,34",
  "no registro civil.",
  "TOTAL 16 231,19 0,00 62,66 18,28 20,89 2,29 0,00 11,55 346,86 346,86",
  "Atos Praticados",
  "16 R$231,19 R$231,19 R$1.500,00 R$104,12 R$346,86 R$346,86",
].join("\n");

test("o relatório de produtividade é lido ato por ato e fecha com o TOTAL", () => {
  const r = parseProductivity(PRODUCTIVITY);
  assert.equal(r.start, "2026-10-05");
  assert.equal(r.end, "2026-10-05");
  assert.equal(r.costsCents, 150000);
  assert.deepEqual(
    r.acts.map((a) => [a.code, a.description, a.quantity, a.emolumentsCents]),
    [
      [
        "2200556",
        "Procuração simples ou substabelecimento - Até 2 outorgantes.",
        2,
        12606,
      ],
      ["2200569", "Reconhecimento de firma", 10, 4210],
      ["", "Ato sem código no relatório", 3, 0],
      ["2300107", "Pedidos de retificação no registro civil.", 1, 6303],
    ],
  );
  const sum = (k: "quantity" | "emolumentsCents" | "issCents" | "grossCents") =>
    r.acts.reduce((s, a) => s + a[k], 0);
  assert.equal(sum("quantity"), 16);
  assert.equal(sum("emolumentsCents"), 23119);
  assert.equal(sum("issCents"), 1155);
  assert.equal(sum("grossCents"), 34686);
});

test("o comprovante do banco e o DAM dão valor, data e categoria", () => {
  const r = parseReceipt(
    [
      "D.A.M - DOCUMENTO DE ARRECADAÇÃO MUNICIPAL DO CONTRIBUINTE AVULSO",
      "TIPO DE DOCUMENTO ISS",
      "Comprovante de pagamento",
      "Convenio: PM DE CIDADE EXEMPLO-",
      "Valor: 104,97",
      "Identificação da operação: NOTA 000123",
      "Data de debito: 22/12/2026",
    ].join("\n"),
  );
  assert.deepEqual(r, {
    amountCents: 10497,
    paidOn: "2026-12-22",
    description: "ISS recolhido à prefeitura (NOTA 000123)",
    category: "iss",
  });
  assert.equal(parseReceipt("nada aqui").amountCents, null);
});

const entry = (over: Partial<BookEntry>): BookEntry => ({
  id: "x",
  kind: "receita",
  date: "2026-10-05",
  specialty: "Tabelionato de Notas",
  category: "",
  actCode: "",
  description: "Ato fictício",
  quantity: 1,
  amountCents: 0,
  fundsCents: 0,
  issCents: 0,
  supplier: "",
  documentRef: "",
  fiscalDistinct: false,
  fiscalNote: "",
  explanation: "",
  hasAttachment: false,
  ...over,
});

test("apuração: receitas e despesas à parte, saldo, repasses fora", () => {
  const s = summarize([
    entry({
      amountCents: 100000,
      fundsCents: 30000,
      issCents: 5000,
      quantity: 10,
    }),
    entry({
      specialty: "Registro Civil das Pessoas Naturais",
      amountCents: 20000,
      quantity: 2,
    }),
    entry({
      kind: "despesa",
      category: "locacao",
      amountCents: 50000,
      date: "2026-10-10",
    }),
    entry({
      kind: "despesa",
      category: "iss",
      amountCents: 5000,
      date: "2026-10-10",
    }),
  ]);
  assert.equal(s.revenueCents, 120000);
  assert.equal(s.expensesCents, 55000);
  assert.equal(s.balanceCents, 65000);
  assert.equal(s.fundsCents, 30000);
  assert.equal(s.acts, 12);
  assert.equal(s.bySpecialty.length, 2);
  assert.equal(s.byDay.length, 2);
  assert.match(categoryLabel("iss"), /art\. 191-A, § 1º, X\)/);
});

test("especialidade pelo código, despesa pessoal e despesa fora do mês", () => {
  const settings = { specialties: DEFAULT_SPECIALTIES, responsible: "" };
  assert.equal(specialtyOf("2200556", settings), "Tabelionato de Notas");
  assert.equal(
    specialtyOf("2300107", settings),
    "Registro Civil das Pessoas Naturais",
  );
  assert.equal(specialtyOf("2601599", settings), "Atos de código 26");
  assert.ok(looksPersonal("Compra no supermercado da família"));
  assert.ok(!looksPersonal("Aluguel do imóvel da serventia"));
  assert.ok(lateExpense({ kind: "despesa", date: "2026-10-30" }, "2026-11-02"));
  assert.ok(
    !lateExpense({ kind: "despesa", date: "2026-10-30" }, "2026-10-31"),
  );
});

const tenant = {
  name: "Cartório Fictício",
  officialName: "Cartório Fictício de Exemplo",
  subtitle: "Notas e Registros",
  cns: "00.000-0",
  location: { city: "Cidade Exemplo", state: "RN" },
  owner: { name: "Maria Exemplo" },
  holderTitle: "Tabeliã",
  legalFooter: "Rodapé fictício",
} as unknown as Tenant;

test("a página do mês tem as colunas do art. 189, a apuração e as explicações", () => {
  const doc = buildBookDocument(tenant, {
    kind: "mes",
    start: "2026-10-01",
    end: "2026-10-31",
    issuedOn: "2026-11-03",
    entries: [
      entry({
        amountCents: 100000,
        explanation: "Retifica o lançamento de 04/10",
      }),
      entry({
        kind: "despesa",
        category: "locacao",
        amountCents: 50000,
        fiscalDistinct: true,
        fiscalNote: "não dedutível",
      }),
    ],
    months: [],
    notes: "",
    signer: null,
  });
  const text = JSON.stringify(doc);
  assert.match(text, /Discriminação da receita e da despesa/);
  assert.match(text, /Apuração do mês \(art\. 192\)/);
  assert.match(text, /Saldo positivo/);
  assert.match(text, /Retifica o lançamento de 04\/10/);
  assert.match(text, /Tratamento fiscal distinto: não dedutível/);

  const year = buildAnnualDocument(tenant, {
    kind: "ano",
    start: "2026-01-01",
    end: "2026-12-31",
    issuedOn: "2027-01-10",
    entries: [],
    months: [{ month: "2026-10", revenueCents: 100000, expensesCents: 150000 }],
    notes: "",
    signer: null,
  });
  assert.match(
    JSON.stringify(year),
    /resultado líquido negativo de R\$ 500,00/,
  );
  const csv = bookCsv({
    kind: "dia",
    start: "2026-10-05",
    end: "2026-10-05",
    issuedOn: "2026-10-05",
    entries: [entry({ amountCents: 4210, description: "Firma; fictícia" })],
    months: [],
    notes: "",
    signer: null,
  });
  assert.ok(csv.startsWith("﻿"));
  assert.match(csv, /"Firma; fictícia"/);
});
