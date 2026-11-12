import assert from "node:assert/strict";
import { test } from "node:test";
import type { Tenant } from "../tenant/schema.ts";
import type { BookEntry } from "./book.ts";
import {
  buildJusticaAbertaDocument,
  cnjSpecialtyOf,
  type FcrcpnRepasse,
  justicaAbertaFigures,
  parseSemester,
  repassesIn,
  semesterToFill,
  shiftSemester,
} from "./justica-aberta.ts";

const entry = (over: Partial<BookEntry>): BookEntry => ({
  id: "x",
  kind: "receita",
  date: "2026-02-05",
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

const repasse = (over: Partial<FcrcpnRepasse>): FcrcpnRepasse => ({
  id: "r",
  receivedOn: "2026-03-10",
  competence: "2026-02",
  payer: "Associação fictícia",
  receivedCents: 0,
  withheldCents: 0,
  notes: "",
  createdAt: "2026-03-10T12:00:00.000Z",
  createdBy: "u",
  ...over,
});

test("especialidade do formulário pelo nome usado no livro", () => {
  assert.equal(cnjSpecialtyOf("Registro Civil das Pessoas Naturais"), "rcpn");
  assert.equal(cnjSpecialtyOf("Tabelionato de Notas"), "notas");
  assert.equal(cnjSpecialtyOf("Registro de Imóveis"), "ri");
  assert.equal(cnjSpecialtyOf("Protesto de Títulos"), "protesto");
  assert.equal(cnjSpecialtyOf("Registro de Títulos e Documentos"), "rtd");
  assert.equal(cnjSpecialtyOf("Registro Civil das Pessoas Jurídicas"), "rcpj");
  // A name that says none, or two, is not guessed.
  assert.equal(cnjSpecialtyOf("Atos de código 99"), null);
  assert.equal(
    cnjSpecialtyOf("Títulos e Documentos e Pessoas Jurídicas"),
    null,
  );
});

test("semestres como o formulário lista: 01/01 a 30/06 e 01/07 a 31/12", () => {
  const first = parseSemester("2026-1");
  assert.equal(first?.label, "01/01/2026 a 30/06/2026");
  assert.deepEqual(first?.months.slice(0, 2), ["2026-01", "2026-02"]);
  assert.equal(parseSemester("2026-2")?.end, "2026-12-31");
  assert.equal(parseSemester("2026-3"), null);
  // In January, the second half of last year; in July, the first half.
  assert.equal(semesterToFill("2027-01-08"), "2026-2");
  assert.equal(semesterToFill("2026-07-03"), "2026-1");
  assert.equal(shiftSemester("2026-1", -1), "2025-2");
  assert.equal(shiftSemester("2025-2", 1), "2026-1");
});

test("figuras do Justiça Aberta: emolumentos por especialidade, FCRCPN em terceiros-outros, despesas de funcionamento", () => {
  const semester = parseSemester("2026-1");
  assert.ok(semester);
  const entries = [
    entry({
      specialty: "Registro Civil das Pessoas Naturais",
      quantity: 10,
      amountCents: 100_000,
      fundsCents: 30_000,
      issCents: 5_000,
    }),
    entry({ quantity: 4, amountCents: 50_000, date: "2026-03-02" }),
    entry({ specialty: "Atos de código 99", quantity: 1, amountCents: 700 }),
    entry({ kind: "despesa", amountCents: 80_000, specialty: "" }),
    entry({
      kind: "deposito",
      amountCents: 9_000,
      description: "Depósito fictício",
    }),
    // Outside the semester.
    entry({ date: "2026-07-01", amountCents: 999_999 }),
  ];
  const fcrcpn = repassesIn(
    {
      repasses: [
        repasse({ receivedCents: 20_000 }),
        repasse({ id: "fora", receivedOn: "2026-08-01", receivedCents: 1 }),
        repasse({ id: "excl", receivedCents: 5, removedAt: "x" }),
      ],
      noneIn: [],
    },
    semester,
  );
  assert.equal(fcrcpn.length, 1);
  const f = justicaAbertaFigures(entries, semester, fcrcpn);
  const rcpn = f.specialties.find((s) => s.id === "rcpn");
  assert.deepEqual(rcpn, {
    id: "rcpn",
    label: "Registro Civil das Pessoas Naturais",
    acts: 10,
    ownCents: 100_000,
    legalCents: 0,
    otherCents: 20_000,
    totalCents: 120_000,
  });
  const notas = f.specialties.find((s) => s.id === "notas");
  assert.equal(notas?.totalCents, 50_000);
  assert.equal(notas?.otherCents, 0);
  assert.deepEqual(f.expenses, {
    operatingCents: 80_000,
    legalCents: 0,
    otherCents: 0,
    totalCents: 80_000,
  });
  assert.equal(f.grossCents, 170_000);
  assert.equal(f.netCents, 90_000);
  assert.deepEqual(f.unmatched, [
    { name: "Atos de código 99", acts: 1, cents: 700 },
  ]);
  assert.equal(f.fundsCents, 30_000);
  assert.equal(f.issCents, 5_000);
  assert.equal(f.deposits.length, 1);
  assert.deepEqual(f.monthsWithoutRevenue, [
    "2026-01",
    "2026-04",
    "2026-05",
    "2026-06",
  ]);
});

test("PDF do Justiça Aberta: campos do formulário, FCRCPN e origem dos valores", () => {
  const semester = parseSemester("2026-1");
  assert.ok(semester);
  const f = justicaAbertaFigures([entry({ amountCents: 50_000 })], semester, [
    repasse({ receivedCents: 20_000, withheldCents: 1_500 }),
  ]);
  const tenant = {
    name: "Cartório Fictício",
    subtitle: "Serviço Notarial e Registral",
    cns: "00.000-0",
    location: { city: "Exemplo", state: "RN" },
    owner: { name: "Maria Exemplo" },
    legalFooter: "",
    holderTitle: "Tabeliã",
  } as unknown as Tenant;
  const text = JSON.stringify(
    buildJusticaAbertaDocument(tenant, semester, f, "2026-07-10", null, false),
  );
  assert.match(text, /01\/01\/2026 a 30\/06\/2026/);
  assert.match(text, /Despesas de funcionamento/);
  assert.match(text, /Receita bruta total/);
  assert.match(text, /Repasse do FCRCPN/);
  assert.match(text, /Provimento CNJ nº 24\/2012, art\. 2º/);
});
