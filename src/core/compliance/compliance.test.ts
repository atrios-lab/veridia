import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrefillSource } from "./answers.ts";
import {
  changedAfterSubmit,
  effectiveAnswers,
  parseAnswer,
  prefillAnswers,
  progress,
  resumeSection,
  revenueOrigins,
  sectionStatus,
} from "./answers.ts";
import { classBoundary, classificationOf, classify } from "./classification.ts";
import { toGeneratorJson } from "./export.ts";
import { detectPendencies, unknownAnswers } from "./pendencies.ts";
import { type Answers, findSection, SECTIONS } from "./sections.ts";

const PREFILL_SOURCE: PrefillSource = {
  officialName: "Ofício Único de Bom Jesus",
  tradeName: "Cartório de Bom Jesus",
  cns: "09.473-0",
  address: "Praça Padre João Maria, 24",
  city: "Bom Jesus / RN",
  phone: "(84) 4042-0949",
  email: "cartorio@exemplo.com",
  attributions: ["RCPN", "NOTAS"],
  ownerName: "Maria Clara Fonseca",
  dpoName: "Liana Andrade",
  dpoEmail: "dpo@exemplo.com",
};

const PREFILL = prefillAnswers(PREFILL_SOURCE);

function section(id: string) {
  const found = findSection(id);
  assert.ok(found, `seção ${id}`);
  return found;
}

test("art. 16: revenue picks the class and the subclass at every boundary", () => {
  assert.deepEqual(
    [
      100_000, 100_000.01, 300_000, 300_000.01, 700_000, 1_100_000, 1_500_000,
      4_500_000, 9_000_000, 18_000_000, 18_000_001,
    ].map((r) => `${classify(r)?.classe}${classify(r)?.subclasse}`),
    ["1A", "1B", "1C", "2D", "2D", "2E", "2F", "3G", "3H", "3I", "3J"],
  );
  assert.equal(classify(0), null);
  assert.equal(classify(Number.NaN), null);
});

test("art. 20: Etapa 1 counts 300, 240 or 180 days from the day in force", () => {
  const one = classify(200_000, "2026-08-22");
  assert.equal(one?.stage1Deadline, "2027-06-18");
  assert.equal(one?.completionDeadline, "2029-08-22");
  assert.equal(classify(1_000_000, "2026-08-22")?.stage1Days, 240);
  assert.equal(classify(2_000_000, "2026-08-22")?.stage1Days, 180);
});

test("a prefilled section stays 'não iniciada' until the office opens it", () => {
  const answers = effectiveAnswers({}, PREFILL);
  assert.equal(answers.serventia.officialName, "Ofício Único de Bom Jesus");
  assert.equal(
    sectionStatus(section("serventia"), answers, false),
    "not-started",
  );
  // Opened, but CNPJ, CEP and revenue still empty.
  assert.equal(
    sectionStatus(section("serventia"), answers, true),
    "in-progress",
  );
});

test("defaults follow earlier answers: nationality from gender, nobreak from inventory", () => {
  const stored: Answers = {
    titular: { gender: "masculine" },
    equipamentos: {
      inventory: [{ type: "ups", brand: "SMS", upsMinutes: "15-30" }],
    },
  };
  const answers = effectiveAnswers(stored, PREFILL);
  assert.equal(answers.titular.nationality, "brasileiro");
  assert.equal(answers.energia.hasUps, "yes");
  assert.equal(answers.energia.upsMinutes, "15-30");
  // What the office typed wins over any default.
  const typed = effectiveAnswers(
    { ...stored, titular: { gender: "masculine", nationality: "portuguesa" } },
    PREFILL,
  );
  assert.equal(typed.titular.nationality, "portuguesa");
});

test("conditional questions only count when shown", () => {
  const energia = section("energia");
  const base: Answers = {
    energia: {
      hasUps: "no",
      hasGenerator: "no",
      outageFrequency: "rarely",
      outageDuration: "short",
      surgeDamage: "no",
      grounding: "with-report",
    },
  };
  // upsMinutes is hidden (no nobreak), threePhase is hidden (laudo exists).
  assert.equal(sectionStatus(energia, base, true), "complete");
  const withoutReport: Answers = {
    energia: { ...base.energia, grounding: "without-report" },
  };
  assert.equal(sectionStatus(energia, withoutReport, true), "in-progress");
});

test("a list is incomplete while an item misses a required field", () => {
  const equipe = section("equipe");
  const answers: Answers = {
    equipe: {
      team: [{ name: "Ana", role: "clerk", gender: "" }],
      personalDevices: "no",
    },
  };
  assert.equal(sectionStatus(equipe, answers, true), "in-progress");
  answers.equipe.team = [{ name: "Ana", role: "clerk", gender: "feminine" }];
  assert.equal(sectionStatus(equipe, answers, true), "complete");
});

test("progress counts complete sections and resumes at the latest open one", () => {
  const touched = {
    energia: "2026-09-05T20:48:00.000Z",
    anexos: "2026-09-01T10:00:00.000Z",
    softwares: "2026-09-04T10:00:00.000Z",
  };
  const answers = effectiveAnswers({}, PREFILL);
  const p = progress(answers, touched);
  assert.equal(p.total, SECTIONS.length);
  // Anexos has no required field: touching it completes it.
  assert.equal(p.statuses.anexos, "complete");
  assert.equal(p.complete, 1);
  assert.equal(p.ready, false);
  assert.equal(resumeSection(p, touched).id, "energia");
  assert.deepEqual(changedAfterSubmit(touched, "2026-09-04T12:00:00.000Z"), [
    "energia",
  ]);
});

test("the server refuses what the screen could never have sent", () => {
  const ctx = { answers: {} as Answers };
  const cpf = section("titular").fields.find((f) => f.name === "cpf");
  const gender = section("titular").fields.find((f) => f.name === "gender");
  assert.ok(cpf && gender);
  assert.deepEqual(parseAnswer(cpf, "111.111.111-11", ctx), {
    error: "CPF inválido. Confira os dígitos.",
  });
  assert.deepEqual(parseAnswer(cpf, "529.982.247-25", ctx), {
    value: "529.982.247-25",
  });
  assert.deepEqual(parseAnswer(gender, "neutral", ctx), {
    error: "Escolha uma das opções.",
  });
  assert.deepEqual(parseAnswer(gender, "feminine", ctx), { value: "feminine" });
});

test("pendencies read the answers the way the generator will", () => {
  const answers: Answers = {
    softwares: { windows: "windows-10", office: "m365", antivirus: "none" },
    backup: {
      hasBackup: "yes",
      locations: ["google-drive"],
      restoreTested: "never",
    },
    acessos: { mfa: "some", logins: "all-own" },
    energia: { grounding: "without-report", threePhase: "yes" },
    internet: { routerBrand: "unknown" },
  };
  const codes = detectPendencies(answers).map((p) => `${p.severity}:${p.code}`);
  assert.deepEqual(codes, [
    "critical:windows-10",
    "critical:no-antivirus",
    "warning:cloud-unencrypted",
    "warning:restore-untested",
    "info:grounding-declaration",
    "warning:partial-mfa",
  ]);
  assert.deepEqual(
    unknownAnswers(answers).map((u) => u.field),
    ["routerBrand"],
  );
});

test("the export speaks the generator's vocabulary", () => {
  const answers = effectiveAnswers(
    {
      serventia: { revenueLastSemester: "184300" },
      titular: { gender: "feminine", role: "notary-and-registrar" },
      equipe: {
        team: [
          { name: "Maria Clara Fonseca", role: "owner", gender: "feminine" },
          { name: "Ana Beatriz", role: "substitute", gender: "feminine" },
        ],
      },
      "responsavel-tecnico": { person: "Ana Beatriz" },
    },
    PREFILL,
  );
  const json = toGeneratorJson({
    tenantSlug: "cartorio-bom-jesus",
    answers,
    classification: classify(184_300, "2026-08-22"),
    pendencies: [],
    unknowns: [],
    attachments: [],
    submittedAt: null,
    version: 0,
  });
  for (const key of [
    "nome",
    "cns",
    "cnpj",
    "endereco",
    "municipio",
    "titular",
    "cargo",
    "tit_nacionalidade",
    "tit_cpf",
    "classe",
    "subclasse",
    "prazo",
    "rt_nome",
    "rt_qualificacao",
    "rt_cpf",
    "rt_genero",
    "dpo_nome",
    "substituto_nome",
    "equipe",
    "equipe_curta",
    "ciencia",
    "sistemas",
    "sis_rcpn",
    "sis_notas",
    "infra",
    "backup",
    "energia",
    "rede",
    "canais_cgj",
    "fornecedores",
    "softwares",
    "inventario",
  ]) {
    assert.ok(key in json, `chave ${key}`);
  }
  assert.equal(json.cargo, "Tabeliã e Oficiala de Registro");
  assert.equal(json.classe, 1);
  assert.equal(json.subclasse, "B");
  assert.equal(json.prazo, "18/06/2027");
  assert.equal(json.rt_qualificacao, "substituta legal, devidamente designada");
  assert.equal(json.rt_genero, "feminino");
  assert.equal(json.substituto_nome, "Ana Beatriz");
  assert.deepEqual(json.ciencia, ["Ana Beatriz"]);
});

test("art. 16: a fronteira só aparece quando uma correção atravessaria a classe", () => {
  // Os dois casos reais da base do RN: Jucurutu passa por R$ 3.767 e Santo
  // Antônio fica por R$ 2.444.
  const jucurutu = classBoundary(303_767.52);
  assert.equal(jucurutu?.limit, 300_000);
  assert.equal(jucurutu?.below, false);
  assert.equal(Math.round(jucurutu?.distance ?? 0), 3768);
  assert.deepEqual(jucurutu?.lower, { classe: 1, stage1Days: 300 });
  assert.deepEqual(jucurutu?.upper, { classe: 2, stage1Days: 240 });

  const santoAntonio = classBoundary(297_556.06);
  assert.equal(santoAntonio?.below, true);
  assert.equal(santoAntonio?.limit, 300_000);

  // O teto de cima separa Classe 2 de Classe 3.
  const natal = classBoundary(1_536_557.95);
  assert.equal(natal?.limit, 1_500_000);
  assert.deepEqual(natal?.lower, { classe: 2, stage1Days: 240 });
  assert.deepEqual(natal?.upper, { classe: 3, stage1Days: 180 });

  // Longe de qualquer teto, e valores que não classificam ninguém.
  assert.equal(classBoundary(98_562.53), null);
  assert.equal(classBoundary(0), null);
  assert.equal(classBoundary(Number.NaN), null);
});

test("a receita levantada preenche os dois semestres, e zero não preenche nada", () => {
  const comReceita = prefillAnswers({
    ...PREFILL_SOURCE,
    revenue: {
      semester: 250_348.82,
      previousSemester: 156_199.71,
      extractedOn: "2026-07-10",
    },
  });
  assert.equal(comReceita.serventia.revenueLastSemester, "250348.82");
  assert.equal(comReceita.serventia.revenuePreviousSemester, "156199.71");

  // Major Sales: declarou o semestre atual, não o anterior. Ausência não é
  // zero, então o campo simplesmente não nasce.
  const semAnterior = prefillAnswers({
    ...PREFILL_SOURCE,
    revenue: { semester: 633_886.4, extractedOn: "2026-07-10" },
  });
  assert.equal(semAnterior.serventia.revenueLastSemester, "633886.4");
  assert.equal(semAnterior.serventia.revenuePreviousSemester, undefined);

  // Zero na origem é declaração que não foi enviada: nunca vira o número zero,
  // que classificaria a serventia em Classe 1 subclasse A sem ninguém declarar.
  const zerado = prefillAnswers({
    ...PREFILL_SOURCE,
    revenue: {
      semester: 0,
      previousSemester: 51_142.27,
      extractedOn: "2026-07-10",
    },
  });
  assert.equal(zerado.serventia.revenueLastSemester, undefined);
  assert.equal(zerado.serventia.revenuePreviousSemester, "51142.27");
  assert.equal(classificationOf(effectiveAnswers({}, zerado)), null);

  // Serventia nunca levantada continua com os dois campos vazios.
  assert.equal(PREFILL.serventia.revenueLastSemester, undefined);
});

test("o que a serventia digita vence a receita levantada", () => {
  const prefill = prefillAnswers({
    ...PREFILL_SOURCE,
    revenue: { semester: 250_348.82, extractedOn: "2026-07-10" },
  });
  const answers = effectiveAnswers(
    { serventia: { revenueLastSemester: "310000" } },
    prefill,
  );
  assert.equal(answers.serventia.revenueLastSemester, "310000");
  assert.equal(classificationOf(answers)?.classe, 2);
});

test("a nota de origem sabe o que foi levantado e o que não foi", () => {
  // Bom Jesus: os dois semestres declarados.
  const doisSemestres = revenueOrigins({
    revenue: {
      semester: 250_348.82,
      previousSemester: 156_199.71,
      source: "justica-aberta",
      extractedOn: "2026-07-10",
    },
  });
  assert.deepEqual(doisSemestres.revenueLastSemester, {
    kind: "value",
    value: "250348.82",
    extractedOn: "2026-07-10",
  });
  assert.equal(doisSemestres.revenuePreviousSemester?.kind, "value");

  // Major Sales: declarou o atual, não o anterior. O campo vazio ganha nota
  // própria, senão parece pergunta que ninguém fez.
  const semAnterior = revenueOrigins({
    revenue: {
      semester: 633_886.4,
      source: "justica-aberta",
      extractedOn: "2026-07-10",
    },
  });
  assert.equal(semAnterior.revenueLastSemester?.kind, "value");
  assert.deepEqual(semAnterior.revenuePreviousSemester, {
    kind: "missing",
    extractedOn: "2026-07-10",
  });

  // Serventia nunca levantada: nada a atribuir, nada a datar.
  assert.deepEqual(revenueOrigins({ revenue: undefined }), {});
});
