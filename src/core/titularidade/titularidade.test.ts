import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultIssSettings } from "../iss/declaration.ts";
import type { Tenant } from "../tenant/schema.ts";
import { buildOficio, transfersCsv } from "./documents.ts";
import {
  actDateIn,
  addressIn,
  bookAndPageIn,
  centsFrom,
  channelFor,
  deadlineOf,
  emptyTransfer,
  operationIn,
  partiesFromText,
  type TitleTransfer,
  taxBaseIn,
  transferProblems,
} from "./titularidade.ts";

// Fictitious parties only (LGPD). 529.982.247-25 is a test CPF that
// passes the check digits.
const CPF = "529.982.247-25";

const SAMPLE = `ESCRITURA PÚBLICA DE COMPRA E VENDA. Aos dez dias do mês de outubro do ano de dois mil e vinte e seis, nesta cidade, perante mim, compareceram: como VENDEDORA, MARIA FICTÍCIA, brasileira, solteira, CPF ${CPF}; Livro 12, folhas 34/35. O imóvel situado na Rua das Flores Fictícias, nº 10, Centro, com área de 200 m², matrícula nº 1.234. Base de cálculo do ITBI: R$ 120.000,00.`;

test("lê do texto o ato, a data, o livro, o endereço e a base de cálculo", () => {
  assert.equal(operationIn(SAMPLE), "11");
  assert.equal(
    operationIn("Escritura de doação com reserva de usufruto"),
    "67",
  );
  assert.equal(operationIn("doação em adiantamento da legítima"), "55");
  assert.equal(operationIn("Registro de carta de adjudicação"), "15");
  assert.equal(actDateIn(SAMPLE), "2026-10-10");
  assert.equal(
    actDateIn("Escritura lavrada em 05/03/2026, no livro 1"),
    "2026-03-05",
  );
  assert.deepEqual(bookAndPageIn(SAMPLE), { book: "12", page: "34/35" });
  assert.equal(addressIn(SAMPLE), "Rua das Flores Fictícias, nº 10, Centro");
  assert.equal(taxBaseIn(SAMPLE), 12000000);
});

test("partes, uma por linha, com o CPF conferido", () => {
  const parties = partiesFromText(
    `Maria Fictícia; 52998224725; 50%\nJoão Modelo; 123\n\n`,
  );
  assert.deepEqual(parties[0], {
    name: "Maria Fictícia",
    taxId: CPF,
    share: "50%",
  });
  assert.equal(parties[1]?.taxId, "123");
  assert.equal(parties.length, 2);
  assert.equal(centsFrom("150.000,50"), 15000050);
  assert.equal(centsFrom(""), null);
  assert.equal(centsFrom("abc"), undefined);
});

test("o ato precisa dizer a operação, as partes e o imóvel (art. 184-A, § 3º)", () => {
  const problems = transferProblems(emptyTransfer()).join(" ");
  assert.match(problems, /data da lavratura/);
  assert.match(problems, /§ 3º/);
  assert.match(problems, /transmitente/);
  assert.match(problems, /adquirente/);
  assert.match(problems, /Identifique o imóvel/);
  const bad = transferProblems({
    ...complete(),
    adquirentes: [{ name: "João", taxId: "111.111.111-11", share: "" }],
  });
  assert.deepEqual(bad, ["João: CPF ou CNPJ inválido (111.111.111-11)."]);
  assert.deepEqual(transferProblems(complete()), []);
});

test("plataforma do envio pelo serviço dos atos (art. 184-A, § 2º)", () => {
  assert.equal(channelFor(["notas"]), "cnb");
  assert.equal(channelFor(["ri", "ri"]), "onr");
  assert.equal(channelFor(["notas", "ri"]), "cnb-onr");
  assert.equal(channelFor([]), "cnb");
});

test("prazo: último dia útil do mês seguinte", () => {
  // Outubro/2026 → 30/11/2026, segunda-feira.
  assert.equal(deadlineOf("2026-10"), "2026-11-30");
  // Dezembro/2026 → janeiro/2027: 31/01 é domingo, vale sexta 29/01.
  assert.equal(deadlineOf("2026-12"), "2027-01-29");
  // Novembro/2026 → dezembro: 31/12 é véspera de Ano Novo, sem
  // expediente no calendário da serventia; vale 30/12.
  assert.equal(deadlineOf("2026-11"), "2026-12-30");
});

function complete(): TitleTransfer {
  return {
    ...emptyTransfer("notas"),
    actDate: "2026-10-10",
    book: "12",
    page: "34/35",
    operation: "11",
    destination: "urbano",
    matricula: "1.234",
    fiscalRegistration: "01.02.003.0004",
    address: "Rua das Flores Fictícias, 10",
    valueCents: 15000000,
    taxBaseCents: 12000000,
    transmitentes: [{ name: "Maria Fictícia", taxId: CPF, share: "100%" }],
    adquirentes: [{ name: "João Modelo", taxId: "", share: "100%" }],
  };
}

const TENANT = {
  officialName: "Cartório Fictício",
  name: "Cartório Fictício",
  subtitle: "Serviço Notarial e Registral",
  location: { city: "Cidade Fictícia", state: "RN" },
  legalFooter: "Rodapé fictício",
  holderName: "Tabeliã Fictícia",
  holderTitle: "Tabeliã",
  contacts: {},
} as unknown as Tenant;

test("ofício do mês com a relação, ou sem movimento", () => {
  const settings = defaultIssSettings(TENANT);
  const doc = buildOficio(TENANT, {
    number: "4/2026",
    competence: "2026-10",
    transfers: [complete()],
    settings,
    issuedOn: "2026-11-14",
  });
  const text = doc.sections.flatMap((s) => s.paragraphs ?? []).join(" ");
  assert.match(text, /art\. 184-A/);
  assert.match(text, /outubro de 2026/);
  assert.match(text, /sem cobrança de custas ou emolumentos/);
  assert.equal(doc.sections.find((s) => s.table)?.table?.rows.length, 1);
  assert.equal(doc.signee, "Tabeliã Fictícia");
  const none = buildOficio(TENANT, {
    number: "5/2026",
    competence: "2026-09",
    transfers: [],
    settings,
    issuedOn: "2026-10-01",
  });
  assert.match(none.subtitle, /sem movimento/);
  assert.match(
    none.sections.flatMap((s) => s.paragraphs ?? []).join(" "),
    /não foi praticado/,
  );
});

test("planilha com o código da DOI, aberta no Excel", () => {
  const csv = transfersCsv([complete()]);
  assert.ok(csv.startsWith("﻿"));
  const [, row] = csv.trim().split("\r\n");
  assert.match(row ?? "", /;11;Compra e venda;urbano;1\.234;/);
  assert.match(row ?? "", /150000,00;120000,00/);
});
