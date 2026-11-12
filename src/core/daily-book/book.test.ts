import assert from "node:assert/strict";
import { test } from "node:test";
import type { Tenant } from "../tenant/schema.ts";
import {
  annualTotals,
  type BookEntry,
  bookCsv,
  buildAnnualDocument,
  buildBalanceOficio,
  buildBookDocument,
  buildClosingDocument,
  buildOpeningDocument,
  categoryLabel,
  DEFAULT_SPECIALTIES,
  defaultOficioAddressee,
  EXPENSE_CATEGORIES,
  interimFigures,
  interimPeriodOf,
  lateExpense,
  SettingsSchema,
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

test("especialidade pelo código e despesa fora do mês", () => {
  const settings = SettingsSchema.parse({ specialties: DEFAULT_SPECIALTIES });
  assert.equal(specialtyOf("2200556", settings), "Tabelionato de Notas");
  assert.equal(
    specialtyOf("2300107", settings),
    "Registro Civil das Pessoas Naturais",
  );
  assert.equal(specialtyOf("2601599", settings), "Atos de código 26");
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
  assert.match(text, /Saldo líquido positivo/);
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

test("RN: o balanço cita o art. 62 e o envio à Corregedoria em 5 dias", () => {
  const year = buildAnnualDocument(tenant, {
    kind: "ano",
    start: "2026-01-01",
    end: "2026-12-31",
    issuedOn: "2027-01-12",
    entries: [],
    months: [],
    notes: "",
    signer: null,
  });
  const text = JSON.stringify(year);
  assert.match(text, /CGJ\/RN, art\. 62/);
  assert.match(text, /até 5 \(cinco\) dias depois de sua conclusão/);
  assert.match(
    text,
    /com receitas de R\$ 0,00, despesas de R\$ 0,00 e resultado líquido/,
  );
  const elsewhere = buildAnnualDocument(
    {
      ...tenant,
      location: { city: "Exemplo", state: "PB" },
    } as unknown as Tenant,
    {
      kind: "ano",
      start: "2026-01-01",
      end: "2026-12-31",
      issuedOn: "2027-01-12",
      entries: [],
      months: [],
      notes: "",
      signer: null,
    },
  );
  assert.doesNotMatch(JSON.stringify(elsewhere), /CGJ\/RN/);
});

test("art. 191-A, § 1º: as doze categorias com o texto da lei", () => {
  const withLaw = EXPENSE_CATEGORIES.filter((c) => c.law);
  assert.deepEqual(
    withLaw.map((c) => c.law),
    ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"],
  );
  assert.equal(
    categoryLabel("locacao"),
    "Locação de bens móveis e imóveis utilizados na prestação do serviço ou na guarda do acervo (art. 191-A, § 1º, I)",
  );
  assert.match(categoryLabel("saude"), /admitida a inclusão do delegatário/);
});

test("art. 190: receita com especialidade e identificação do ato; art. 192 com o texto da lei", () => {
  const doc = buildBookDocument(tenant, {
    kind: "mes",
    start: "2026-10-01",
    end: "2026-10-31",
    issuedOn: "2026-11-03",
    entries: [
      entry({
        amountCents: 10000,
        actCode: "2200556",
        description: "Procuração",
        documentRef: "Livro 12, fls. 30",
      }),
      entry({ kind: "despesa", category: "materiais", amountCents: 2500 }),
    ],
    months: [],
    notes: "",
    signer: null,
    book: { number: 2, sheetCount: 200, firstSheet: 7, lastSheet: 8 },
  });
  const text = JSON.stringify(doc);
  assert.match(
    text,
    /Tabelionato de Notas: 2200556 - Procuração; Livro 12, fls\. 30/,
  );
  assert.match(text, /Despesa \(art\. 191-A, § 1º, VI\)/);
  assert.match(text, /Saldo líquido positivo/);
  assert.match(text, /nº 2, folhas 7 a 8/);
  assert.deepEqual(doc.sheet, { first: 7, label: "Livro nº 2 · Folha" });
});

test("art. 186: termo de abertura com os elementos do parágrafo único; encerramento", () => {
  const base = {
    start: "2026-11-11",
    end: "2026-11-11",
    issuedOn: "2026-11-11",
    entries: [],
    months: [],
    notes: "",
    signer: null,
  };
  const opening = buildOpeningDocument(tenant, {
    ...base,
    kind: "abertura",
    book: { number: 3, sheetCount: 200 },
  });
  const text = JSON.stringify(opening);
  assert.match(text, /Número do livro/);
  assert.match(text, /Fim a que se destina/);
  assert.match(text, /200 \(duzentos\)/);
  assert.match(text, /Declaro que todas as suas folhas estão rubricadas/);
  assert.equal(opening.signee, "Maria Exemplo");
  assert.equal(opening.dateLine, "Cidade Exemplo/RN, 11 de novembro de 2026.");
  assert.equal(opening.sheet, undefined);
  const closing = buildClosingDocument(tenant, {
    ...base,
    kind: "encerramento",
    book: { number: 3, sheetCount: 200, lastSheet: 187 },
  });
  assert.match(JSON.stringify(closing), /escrituradas até a folha nº 187/);
});

test("art. 194: período trimestral ou mensal, renda líquida e excedente", () => {
  assert.equal(interimPeriodOf("2026-11", "trimestral"), null);
  assert.deepEqual(interimPeriodOf("2026-12", "trimestral"), {
    start: "2026-10-01",
    end: "2026-12-31",
    months: 3,
  });
  assert.deepEqual(interimPeriodOf("2026-02", "mensal"), {
    start: "2026-02-01",
    end: "2026-02-28",
    months: 1,
  });
  const interim = {
    ceilingCents: 3_000_000,
    period: "trimestral" as const,
    start: "2026-10-01",
    end: "2026-12-31",
    months: 3,
    revenueCents: 15_000_000,
    expensesCents: 4_000_000,
    depositsCents: 0,
  };
  // 150.000 - 40.000 = 110.000; limite 3 x 30.000 = 90.000.
  assert.deepEqual(interimFigures(interim), {
    netCents: 11_000_000,
    limitCents: 9_000_000,
    excessCents: 2_000_000,
  });
  const doc = buildBookDocument(tenant, {
    kind: "mes",
    start: "2026-12-01",
    end: "2026-12-31",
    issuedOn: "2027-01-03",
    entries: [
      entry({
        kind: "deposito",
        date: "2026-12-20",
        amountCents: 2_000_000,
        documentRef: "Conta judicial 0001",
      }),
    ],
    months: [],
    notes: "",
    signer: null,
    interim,
  });
  const text = JSON.stringify(doc);
  assert.match(text, /renda líquida excedente \(art\. 194\)/);
  assert.match(text, /R\$ 30\.000,00 por mês × 3 meses = R\$ 90\.000,00/);
  assert.match(text, /conta Conta judicial 0001/);
  // The deposit is neither revenue nor expense.
  const withDeposit = summarize([entry({ kind: "deposito", amountCents: 9 })]);
  assert.equal(withDeposit.revenueCents + withDeposit.expensesCents, 0);
  assert.equal(withDeposit.depositsCents, 9);
  const titular = buildBookDocument(tenant, {
    kind: "mes",
    start: "2026-10-01",
    end: "2026-10-31",
    issuedOn: "2026-11-03",
    entries: [],
    months: [],
    notes: "",
    signer: null,
    // A snapshot from before: the ceiling only, no period.
    interim: { ceilingCents: 3_000_000 },
  });
  assert.doesNotMatch(JSON.stringify(titular), /art\. 194/);
});

const DETAILED = {
  kind: "ano" as const,
  start: "2026-01-01",
  end: "2026-12-31",
  issuedOn: "2027-01-05",
  entries: [],
  months: [
    {
      month: "2026-01",
      revenueCents: 1_000_000,
      expensesCents: 400_000,
      acts: 120,
      fundsCents: 300_000,
      issCents: 50_000,
    },
    {
      month: "2026-02",
      revenueCents: 500_000,
      expensesCents: 600_000,
      acts: 80,
      fundsCents: 150_000,
      issCents: 25_000,
    },
  ],
  notes: "",
  signer: null,
  book: { number: 2, sheetCount: 200, firstSheet: 31, lastSheet: 32 },
};

test("balanço anual: atos, arrecadação bruta, fundos e ISS, emolumentos, despesas e líquido", () => {
  const t = annualTotals(DETAILED);
  assert.equal(t.detailed, true);
  assert.equal(t.acts, 200);
  assert.equal(t.revenue, 1_500_000);
  assert.equal(t.thirdPartyCents, 525_000);
  assert.equal(t.grossCents, 2_025_000);
  assert.equal(t.net, 500_000);
  const text = JSON.stringify(buildAnnualDocument(tenant, DETAILED));
  assert.match(text, /Arrecadação bruta \(R\$\)/);
  assert.match(text, /Fundos e ISS \(R\$\)/);
  assert.match(text, /20\.250,00/);
  // A negative month keeps its sign.
  assert.match(text, /-1\.000,00/);
  // A balance from before keeps the old columns.
  assert.equal(
    annualTotals({
      months: [{ month: "2026-01", revenueCents: 1, expensesCents: 0 }],
    }).detailed,
    false,
  );
});

test("ofício do balanço: número, destinatário, art. 193 e, no RN, art. 62", () => {
  const doc = buildBalanceOficio(tenant, {
    ...DETAILED,
    oficio: {
      number: "04/2027",
      addressee: "A Sua Excelência\nCorregedor(a)-Geral da Justiça",
      date: "2027-01-05",
    },
  });
  const text = JSON.stringify(doc);
  assert.equal(doc.eyebrow, "Ofício nº 04/2027");
  assert.match(text, /balanço anual do exercício de 2026/);
  assert.match(text, /art\. 193 do Código Nacional de Normas/);
  assert.match(text, /art\. 62 do Código de Normas/);
  assert.match(text, /resultado líquido positivo de R\$ 5\.000,00/);
  assert.match(text, /Livro nº 2, folhas 31 a 32/);
  // The portal only when the caller knows every month is published.
  assert.doesNotMatch(text, /Portal da Transparência/);
  assert.match(
    JSON.stringify(
      buildBalanceOficio(tenant, DETAILED, {
        transparencyUrl: "https://cartorio.exemplo.com.br/transparencia",
      }),
    ),
    /Portal da Transparência da serventia, em https:\/\/cartorio\.exemplo/,
  );
  const elsewhere = buildBalanceOficio(
    {
      ...tenant,
      location: { city: "Exemplo", state: "PB" },
    } as unknown as Tenant,
    DETAILED,
  );
  assert.doesNotMatch(JSON.stringify(elsewhere), /CGJ\/RN|art\. 62/);
});

test("ofício: destinatário sugerido a partir da Corregedoria cadastrada", () => {
  assert.equal(
    defaultOficioAddressee({
      headName: "Fulano Fictício",
      headTitle: "Desembargador Corregedor-Geral",
      authority: "Corregedoria Geral de Justiça do Estado Exemplo",
    }),
    "A Sua Excelência\nFulano Fictício, Desembargador Corregedor-Geral\nCorregedoria Geral de Justiça do Estado Exemplo",
  );
  assert.equal(
    defaultOficioAddressee({}),
    "A Sua Excelência\nCorregedor(a)-Geral da Justiça\nCorregedoria Geral da Justiça",
  );
});
