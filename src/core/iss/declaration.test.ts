import assert from "node:assert/strict";
import { test } from "node:test";
import { TENANTS } from "@/core/tenant/resolve.ts";
import { formatTaxId, isValidTaxId } from "../tax-id.ts";
import {
  addresseeRows,
  buildFilingReceipt,
  buildIssDocument,
  competenceLabel,
  defaultIssSettings,
  dueDateOf,
  formatRate,
  fundsOf,
  issOf,
  issOn,
  issSettingsMissing,
  outsideTheBase,
  portalFields,
} from "./declaration.ts";

const tenant = TENANTS["cartorio-marinho"];

test("ISS sobre os emolumentos, arredondado ao centavo", () => {
  assert.equal(issOn(209_937, 500), 10_497);
  assert.equal(issOn(100_000, 200), 2_000);
  assert.equal(formatRate(500), "5,00%");
  assert.equal(competenceLabel("2026-10"), "outubro de 2026");
});

test("o PDF declara os emolumentos, ratifica o livro e cita a lei", () => {
  const settings = {
    ...defaultIssSettings(tenant),
    cnpj: "00.000.000/0001-00",
    municipalLaw: "Lei Complementar Municipal nº 1/2000 (fictícia), art. 10",
  };
  const doc = buildIssDocument(tenant, {
    declaration: {
      competence: "2026-10",
      emolumentsCents: 1_234_567,
      rateBasisPoints: 500,
      damNumber: "0000123",
      dueDate: "2026-11-10",
      paidOn: "",
      notes: "",
      issCents: null,
      signer: 0,
    },
    settings,
    year: 2026,
    sequence: 3,
    issuedOn: "2026-11-11",
    attachments: 1,
  });
  assert.equal(doc.title, "Declaração de ISS nº 003/2026");
  assert.equal(doc.subtitle, "Competência: outubro de 2026");
  const all = JSON.stringify(doc);
  assert.match(all, /R\$ 12\.345,67/);
  // 5% of 12.345,67 = 617,28 (rounded).
  assert.match(all, /R\$ 617,28/);
  assert.match(
    all,
    /cuja cópia segue anexa e é por esta declaração ratificada/,
  );
  assert.match(all, /Livro Diário Auxiliar da Receita e da Despesa/);
  assert.match(all, /Provimento CN-CNJ nº 259\/2026/);
  assert.match(all, /REsp 1\.328\.384\/RS/);
  assert.match(
    all,
    /Neste Estado \(RN\), esses repasses são: FDJ, FRMP, FCRCPN e FUNAF\/FPGE/,
  );
  assert.match(
    all,
    /Por exemplo: a taxa de fiscalização devida ao Poder Judiciário/,
  );
  assert.match(all, /"highlight":"Não integram a base de cálculo/);
  assert.match(all, /Lei Complementar Municipal nº 1\/2000/);
  assert.match(all, /00\.000\.000\/0001-00/);
  // No en/em dashes in what the fisco reads.
  const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
  assert.doesNotMatch(all, dashes);
});

test("ISS apurado ato a ato no relatório: menor que a alíquota sobre o total", () => {
  const declaration = {
    competence: "2026-09",
    emolumentsCents: 200_000,
    rateBasisPoints: 500,
    damNumber: "",
    dueDate: "",
    paidOn: "",
    notes: "",
    // Fictitious: 10.000 would be 5% of the total; acts without ISS lower it.
    issCents: 9_000,
    signer: 0,
  };
  assert.equal(issOf(declaration), 9_000);
  assert.equal(issOf({ ...declaration, issCents: null }), 10_000);
  const all = JSON.stringify(
    buildIssDocument(tenant, {
      declaration,
      settings: defaultIssSettings(tenant),
      year: 2026,
      sequence: 4,
      issuedOn: "2026-10-05",
      attachments: 3,
    }),
  );
  assert.match(all, /ISS devido \(apurado ato a ato\)/);
  assert.match(all, /R\$ 90,00/);
  assert.match(all, /sobre os emolumentos de cada ato/);
  assert.match(all, /atos sem incidência/);
  assert.match(
    all,
    /cujas cópias seguem anexas e são por esta declaração ratificadas/,
  );
});

test("vencimento: o digitado, ou o dia configurado do mês seguinte", () => {
  const d = { competence: "2026-12", dueDate: "" };
  assert.equal(dueDateOf(d, { dueDay: 10 }), "2027-01-10");
  assert.equal(
    dueDateOf({ competence: "2027-01", dueDate: "" }, { dueDay: 31 }),
    "2027-02-28",
  );
  assert.equal(
    dueDateOf({ ...d, dueDate: "2027-01-05" }, { dueDay: 10 }),
    "2027-01-05",
  );
  assert.equal(dueDateOf(d, { dueDay: null }), "");
});

test("site da prefeitura: os campos do DAM prontos para copiar", () => {
  const settings = {
    ...defaultIssSettings(tenant),
    cnpj: "00.000.000/0001-00",
    portalRevenue: "ISS PRÓPRIO (fictício)",
    dueDay: 15,
    filing: "portal" as const,
  };
  const fields = portalFields(tenant, {
    declaration: {
      competence: "2026-10",
      emolumentsCents: 200_000,
      rateBasisPoints: 500,
      damNumber: "",
      dueDate: "",
      paidOn: "",
      notes: "",
      issCents: 9_000,
      signer: 0,
    },
    settings,
    year: 2026,
    sequence: 2,
    attachments: 2,
  });
  const by = Object.fromEntries(fields.map((f) => [f.key, f.value]));
  assert.deepEqual(
    fields.map((f) => f.label),
    [
      "CPF / CNPJ",
      "Nome / Razão social",
      "Receita",
      "Valor a pagar",
      "Descrição",
      "Data para pagamento",
    ],
  );
  assert.equal(by.documento, "00.000.000/0001-00");
  assert.equal(by.receita, "ISS PRÓPRIO (fictício)");
  assert.equal(by.valor, "90,00");
  assert.equal(by.vencimento, "15/11/2026");
  assert.match(by.descricao, /competência 10\/2026/);
  assert.match(by.descricao, /apurado ato a ato/);
  assert.match(by.descricao, /Declaração de ISS nº 002\/2026/);
});

test("SEMUT: protocolo de entrega com campos para o servidor preencher", () => {
  const doc = buildFilingReceipt(tenant, {
    declaration: {
      competence: "2026-10",
      emolumentsCents: 200_000,
      rateBasisPoints: 500,
      damNumber: "",
      dueDate: "",
      paidOn: "",
      notes: "",
      issCents: null,
      signer: 0,
    },
    settings: defaultIssSettings(tenant),
    year: 2026,
    sequence: 2,
    attachments: 1,
  });
  assert.equal(doc.title, "Protocolo de entrega");
  const all = JSON.stringify(doc);
  assert.match(all, /Declaração de ISS nº 002\/2026/);
  assert.match(all, /R\$ 100,00/);
  assert.match(all, /Recebimento \(preenchido pela SEMUT\)/);
  assert.match(all, /Assinatura e carimbo/);
  assert.equal(defaultIssSettings(tenant).filing, "semut");
});

test("fora do RN, o texto fica geral, sem os fundos do RN", () => {
  const elsewhere = {
    ...tenant,
    location: { ...tenant.location, state: "PB" },
  } as unknown as typeof tenant;
  const text = outsideTheBase(elsewhere);
  assert.doesNotMatch(text, /FDJ|FCRCPN|FUNAF/);
  assert.match(text, /variam conforme a lei de emolumentos de cada Estado/);
  assert.deepEqual(fundsOf(elsewhere), []);
});

test("configuração: o aviso só some com tudo preenchido; destinatário com CNPJ e nomes", () => {
  const base = defaultIssSettings(tenant);
  assert.ok(issSettingsMissing(base).includes("o CNPJ da prefeitura"));
  const full = {
    ...base,
    municipalLaw: "Lei fictícia nº 1/2000",
    cnpj: "11.222.333/0001-81",
    municipalRegistration: "000",
    officeAddress: "Rua Fictícia, 1",
    authorityCnpj: "11.222.333/0001-81",
    authorityAddress: "Praça Fictícia, s/n",
    mayorName: "Fulano Fictício",
    secretaryName: "Beltrana Fictícia",
  };
  assert.deepEqual(issSettingsMissing(full), []);
  const rows = addresseeRows(tenant, full);
  assert.deepEqual(
    rows.map((r) => r.label),
    ["Órgão", "Município", "CNPJ", "Endereço", "Prefeito(a)", "Secretário(a)"],
  );
});

test("CPF ou CNPJ: a pontuação entra sozinha ao digitar e o dígito é conferido", () => {
  assert.equal(formatTaxId("11122233396"), "111.222.333-96");
  assert.equal(formatTaxId("11222333000181"), "11.222.333/0001-81");
  assert.equal(formatTaxId("1122"), "112.2");
  assert.ok(isValidTaxId(""));
  assert.ok(isValidTaxId("11.222.333/0001-81"));
  assert.ok(!isValidTaxId("11.222.333/0001-82"));
});

test("quem assina: o escolhido na lista assina e declara, como nas guias", () => {
  const doc = buildIssDocument(tenant, {
    declaration: {
      competence: "2026-10",
      emolumentsCents: 100_000,
      rateBasisPoints: 500,
      damNumber: "",
      dueDate: "",
      paidOn: "",
      notes: "",
      issCents: null,
      signer: 1,
    },
    settings: defaultIssSettings(tenant),
    year: 2026,
    sequence: 9,
    issuedOn: "2026-11-11",
    attachments: 0,
    signer: { name: "Fulana Fictícia", title: "Substituta", note: "" },
  });
  assert.equal(doc.signee, "Fulana Fictícia");
  assert.deepEqual(doc.signature, ["Substituta"]);
  assert.match(JSON.stringify(doc), /Fulana Fictícia, Substituta da serventia/);
});
