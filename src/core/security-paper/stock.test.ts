import assert from "node:assert/strict";
import { test } from "node:test";
import type { Tenant } from "../tenant/schema.ts";
import {
  buildPrestacaoOficio,
  buildReportDocuments,
  buildSnapshot,
  defaultSecurityPaperSettings,
  reportCsv,
  reportFileName,
} from "./documents.ts";
import { buildSecurityPaperReminderEmail } from "./reminders.ts";
import {
  checkLot,
  checkRange,
  freeRanges,
  nextSheet,
  type PaperLot,
  type PaperMovement,
  parseSheet,
  pendingDuties,
  previousQuarter,
  quarterLabel,
  quarterOf,
  rangeForQuantity,
  rangeLabel,
  remainingIn,
  summarize,
  totalOf,
} from "./stock.ts";

const lot = (over: Partial<PaperLot> = {}): PaperLot => ({
  id: "lote-1",
  kind: "traslado",
  kindLabel: "",
  prefix: "AB",
  first: 1,
  last: 500,
  digits: 6,
  receivedOn: "2026-07-10",
  opening: false,
  supplier: "",
  invoice: "",
  requisition: "",
  notes: "",
  voided: false,
  ...over,
});

let seq = 0;
const move = (over: Partial<PaperMovement> = {}): PaperMovement => ({
  id: `mov-${++seq}`,
  lotId: "lote-1",
  type: "utilizado",
  first: 1,
  last: 1,
  occurredOn: "2026-07-15",
  reference: "",
  notes: "",
  voided: false,
  ...over,
});

test("a numeração é lida como impressa, com a série e os zeros", () => {
  assert.deepEqual(parseSheet("AB 000123"), {
    prefix: "AB",
    n: 123,
    digits: 6,
  });
  assert.deepEqual(parseSheet("ab-000123"), {
    prefix: "AB",
    n: 123,
    digits: 6,
  });
  assert.deepEqual(parseSheet("42"), { prefix: "", n: 42, digits: 2 });
  assert.equal(parseSheet("folha 12"), null);
  assert.equal(rangeLabel(lot(), 1, 50), "AB 000001 a AB 000050");
  assert.equal(rangeLabel(lot(), 7, 7), "AB 000007");
});

test("uso por quantidade baixa a partir da próxima folha livre", () => {
  const moves = [move({ first: 1, last: 100 })];
  assert.equal(nextSheet(lot(), moves), 101);
  assert.deepEqual(rangeForQuantity(lot(), moves, 50), {
    first: 101,
    last: 150,
  });
  // A sheet lost in the middle breaks the run: the office types the numbers.
  const gap = [...moves, move({ type: "extraviado", first: 120, last: 120 })];
  assert.match(
    rangeForQuantity(lot(), gap, 50) as string,
    /só restam 19 folha/,
  );
  assert.deepEqual(freeRanges(lot(), gap), [
    { first: 101, last: 119 },
    { first: 121, last: 500 },
  ]);
  assert.equal(remainingIn(lot(), gap), 399);
});

test("folha já lançada, fora do lote ou lote anulado não sai de novo", () => {
  const moves = [move({ first: 1, last: 100 })];
  assert.match(
    checkRange(lot(), moves, { first: 90, last: 110 }) ?? "",
    /já foram lançadas/,
  );
  assert.match(
    checkRange(lot(), moves, { first: 499, last: 501 }) ?? "",
    /o lote vai de/i,
  );
  assert.equal(checkRange(lot(), moves, { first: 101, last: 101 }), null);
  // A voided movement gives its sheets back.
  const voided = [move({ first: 1, last: 100, voided: true })];
  assert.equal(checkRange(lot(), voided, { first: 50, last: 60 }), null);
  assert.match(
    checkRange(lot({ voided: true }), [], { first: 1, last: 1 }) ?? "",
    /anulado/,
  );
});

test("lote com numeração repetida da mesma espécie e série é recusado", () => {
  assert.match(
    checkLot(lot({ id: "x", first: 400, last: 600 }), [lot()]) ?? "",
    /já está no lote/,
  );
  assert.equal(checkLot(lot({ id: "x", prefix: "AC" }), [lot()]), null);
  assert.equal(checkLot(lot({ id: "x", kind: "certidao" }), [lot()]), null);
  assert.match(
    checkLot(lot({ kind: "outro", kindLabel: " " }), []) ?? "",
    /que papel/i,
  );
});

test("trimestres: o anterior, o rótulo e as datas", () => {
  assert.deepEqual(quarterOf("2026-11-11"), {
    year: 2026,
    quarter: 4,
    start: "2026-10-01",
    end: "2026-12-31",
  });
  assert.equal(previousQuarter("2026-11-11").quarter, 3);
  assert.equal(previousQuarter("2026-02-01").year, 2025);
  assert.equal(
    quarterLabel(quarterOf("2026-08-01")),
    "3º trimestre de 2026 (01/07/2026 a 30/09/2026)",
  );
});

test("o demonstrativo do trimestre fecha: inicial + recebidas - saídas = final", () => {
  const lots = [
    // Old stock, counted in August: still stock at the start of the quarter.
    lot({
      id: "antigo",
      prefix: "",
      first: 900,
      last: 999,
      opening: true,
      receivedOn: "2026-08-02",
    }),
    lot({ id: "lote-1", receivedOn: "2026-07-10" }),
    // Arrived before the quarter.
    lot({
      id: "velho",
      kind: "certidao",
      prefix: "C",
      first: 1,
      last: 10,
      receivedOn: "2026-05-01",
    }),
  ];
  const moves = [
    move({ lotId: "velho", first: 1, last: 2, occurredOn: "2026-06-20" }),
    move({ first: 1, last: 100, occurredOn: "2026-08-10" }),
    move({
      type: "inutilizado",
      first: 101,
      last: 102,
      occurredOn: "2026-08-11",
    }),
    move({
      type: "extraviado",
      first: 103,
      last: 103,
      occurredOn: "2026-09-03",
    }),
    move({
      lotId: "antigo",
      type: "avariado",
      first: 900,
      last: 901,
      occurredOn: "2026-09-05",
    }),
    // Next quarter: out of these accounts.
    move({ first: 104, last: 110, occurredOn: "2026-10-02" }),
  ];
  const rows = summarize(lots, moves, quarterOf("2026-08-01"));
  const traslado = rows.find((r) => r.kind === "Traslado (Notas)");
  assert.ok(traslado);
  assert.equal(traslado.initial, 100);
  assert.equal(traslado.received, 500);
  assert.equal(traslado.moved.utilizado, 100);
  assert.equal(traslado.moved.inutilizado, 2);
  assert.equal(traslado.moved.extraviado, 1);
  assert.equal(traslado.moved.avariado, 2);
  assert.equal(traslado.final, 100 + 500 - 105);
  const certidao = rows.find((r) => r.kind.startsWith("Certidão"));
  assert.equal(certidao?.initial, 8);
  assert.equal(certidao?.final, 8);
  for (const r of [...rows, totalOf(rows)]) {
    const out = Object.values(r.moved).reduce((a, b) => a + b, 0);
    assert.equal(r.initial + r.received - out, r.final, r.kind);
  }
});

test("lembra a prestação do trimestre e o extravio de mês já encerrado", () => {
  const lots = [lot()];
  const loss = move({
    type: "extraviado",
    first: 5,
    last: 5,
    occurredOn: "2026-10-20",
  });
  const fresh = move({
    type: "subtraido",
    first: 6,
    last: 6,
    occurredOn: "2026-11-03",
  });
  const duties = pendingDuties({
    today: "2026-11-11",
    lots,
    movements: [loss, fresh],
    reports: [],
  });
  assert.equal(duties.quarter?.quarter, 3);
  // The current month's theft waits for the end of the month.
  assert.deepEqual(
    duties.occurrences.map((m) => m.id),
    [loss.id],
  );

  const done = pendingDuties({
    today: "2026-11-11",
    lots,
    movements: [loss, fresh],
    reports: [
      {
        kind: "prestacao",
        periodStart: "2026-07-01",
        periodEnd: "2026-09-30",
        movementIds: [],
      },
      {
        kind: "extravio",
        periodStart: "2026-10-01",
        periodEnd: "2026-10-31",
        movementIds: [loss.id],
      },
    ],
  });
  assert.equal(done.quarter, null);
  assert.equal(done.occurrences.length, 0);

  // No paper registered by the end of the quarter: nothing to account for.
  assert.equal(
    pendingDuties({
      today: "2026-11-11",
      lots: [lot({ receivedOn: "2026-10-05" })],
      movements: [],
      reports: [],
    }).quarter,
    null,
  );
});

const tenant = {
  name: "Cartório Fictício",
  officialName: "Cartório Único Fictício",
  subtitle: "Notas e Registros",
  cns: "00.000-0",
  location: { city: "Cidade Exemplo", state: "RN" },
  owner: { name: "Maria Exemplo" },
  holderTitle: "Tabeliã",
  legalFooter: "Rodapé fictício",
} as unknown as Tenant;

test("o ofício de prestação cita o art. 60 do Provimento 156/2016 no RN", () => {
  const snapshot = buildSnapshot({
    kind: "prestacao",
    period: quarterOf("2026-08-01"),
    issuedOn: "2026-10-05",
    number: "004/2026",
    settings: defaultSecurityPaperSettings(tenant),
    lots: [lot()],
    movements: [move({ first: 1, last: 10, occurredOn: "2026-08-10" })],
  });
  const doc = buildPrestacaoOficio(tenant, snapshot);
  const text = JSON.stringify(doc);
  assert.match(text, /art\. 60, § 1º do Provimento nº 156\/2016-CGJ\/RN/);
  assert.match(text, /PRESTA CONTAS/);
  assert.equal(doc.eyebrow, "Ofício nº 004/2026");
  // The ofício and its annex with the numbering.
  assert.equal(buildReportDocuments(tenant, snapshot).length, 2);
  assert.equal(
    reportFileName(snapshot, "pdf"),
    "papel-seguranca-prestacao-2026-T3.pdf",
  );
});

test("fora do RN, sem norma configurada, não cita artigo de outro Estado", () => {
  const other = {
    ...tenant,
    location: { city: "Exemplo", state: "PB" },
  } as unknown as Tenant;
  const settings = defaultSecurityPaperSettings(other);
  assert.equal(settings.stateRule, "");
  assert.match(settings.authority, /da Paraíba/);
  const snapshot = buildSnapshot({
    kind: "extravio",
    period: { start: "2026-10-01", end: "2026-10-31" },
    issuedOn: "2026-11-01",
    number: "001/2026",
    settings,
    lots: [lot()],
    movements: [
      move({
        type: "extraviado",
        first: 3,
        last: 3,
        occurredOn: "2026-10-09",
        reference: "B.O. fictício 1/2026",
      }),
    ],
  });
  const text = JSON.stringify(buildReportDocuments(other, snapshot));
  assert.doesNotMatch(text, /156\/2016/);
  assert.match(text, /às normas da Corregedoria/);
  assert.match(text, /AB 000003/);
});

test("a planilha abre no Excel em português e traz o total", () => {
  const snapshot = buildSnapshot({
    kind: "relatorio",
    period: { start: "2026-01-01", end: "2026-11-11" },
    issuedOn: "2026-11-11",
    number: null,
    settings: defaultSecurityPaperSettings(tenant),
    lots: [lot({ supplier: "Gráfica Exemplo; Ltda", invoice: "123" })],
    movements: [move({ first: 1, last: 5 })],
  });
  const csv = reportCsv(snapshot);
  assert.ok(csv.startsWith("﻿"));
  assert.match(csv, /Total;0;500;5;0;0;0;0;495/);
  assert.match(csv, /"Gráfica Exemplo; Ltda"/);
});

test("o lembrete diz o trimestre e o extravio pendentes", () => {
  const email = buildSecurityPaperReminderEmail({
    officeName: "Cartório Fictício",
    quarter: quarterOf("2026-08-01"),
    occurrences: [{ occurredOn: "2026-10-20" }],
    deadlineDay: 10,
  });
  assert.match(email.subject, /3º trimestre de 2026/);
  const body = email.paragraphs.join(" ");
  assert.match(body, /dia 10/);
  assert.match(body, /outubro de 2026/);
  assert.match(body, /impedido de requisitar/);
});
