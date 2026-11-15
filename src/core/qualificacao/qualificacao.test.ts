import assert from "node:assert/strict";
import { test } from "node:test";
import { TENANTS } from "../tenant/resolve.ts";
import { LIBRARY_SEEDS, seedsOf, servesAct } from "./biblioteca.ts";
import { buildNote, buildPositive } from "./documents.ts";
import {
  ACTS,
  emptyQualification,
  emptyRequirement,
  noteProblems,
  openReexam,
  positiveProblems,
  providencias,
  type QualificationData,
  qualificationProblems,
  reexamView,
  statusOf,
} from "./qualificacao.ts";

const must = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error("valor ausente no teste");
  return value;
};

const TENANT = TENANTS["cartorio-marinho"];
if (!TENANT) throw new Error("sem serventia de teste");

// Fictitious people and documents only (LGPD).
function divorcio(): QualificationData {
  const data = emptyQualification("rcpn", "2026-11-10");
  return {
    ...data,
    act: "divorcio",
    presenter: { name: "Joana Fictícia", document: "RG 0000000", contact: "" },
    document: "Escritura pública de divórcio fictícia, livro 1, folhas 2",
    protocol: "REQ-2026-000001",
  };
}

const req = (
  id: string,
  over: Partial<ReturnType<typeof emptyRequirement>> = {},
) => ({
  ...emptyRequirement(id),
  title: `Exigência ${id}`,
  description: `Falta o documento ${id}.`,
  howToComply: `Apresentar o documento ${id}.`,
  basis: "Lei nº 6.015/1973, art. 29, § 1º.",
  ...over,
});

test("a qualificação pede atribuição, ato, apresentante, título e data", () => {
  const blank = emptyQualification("rcpn", "2026-11-10");
  assert.deepEqual(qualificationProblems(blank), [
    "Escolha o ato pedido.",
    "Informe o apresentante.",
    "Descreva o título apresentado.",
  ]);
  assert.deepEqual(qualificationProblems(divorcio()), []);
  assert.equal(
    qualificationProblems({ ...divorcio(), act: "outro" })[0],
    "Diga qual é o ato pedido.",
  );
  // Every attribution of the office has its acts.
  for (const acts of Object.values(ACTS)) assert.ok(acts.outro);
});

test("a nota sai com as exigências agrupadas, numeradas, fundamentadas e com o direito à dúvida", () => {
  const data = divorcio();
  data.rounds[0] = {
    ...must(data.rounds[0]),
    requirements: [
      req("a", { reference: "Escritura" }),
      req("b", { reference: "Requerente" }),
      req("c", { reference: "Escritura" }),
    ],
  };
  assert.deepEqual(noteProblems(must(data.rounds[0])), []);
  const note = buildNote(TENANT, {
    number: "1/2026",
    data,
    roundIndex: 0,
    issuedOn: "2026-11-12",
  });
  assert.equal(note.title, "Nota devolutiva nº 1/2026");
  const headings = note.sections.map((s) => s.heading);
  assert.deepEqual(headings, [
    "Apresentação",
    "Objeto",
    "Natureza da devolução",
    "Fundamentos",
    "Exigências: Escritura",
    "Exigências: Requerente",
    "Forma de cumprimento",
    "Conclusão",
  ]);
  const text = JSON.stringify(note);
  assert.match(text, /1\. Exigência a\./);
  assert.match(text, /2\. Exigência c\./);
  assert.match(text, /3\. Exigência b\./);
  assert.match(text, /art\. 198, II/);
  assert.match(text, /Fundamento: Lei nº 6\.015\/1973/);
  assert.doesNotMatch(text, /\u2013|\u2014/);
});

test("exigência incompleta não sai na nota; sem pendência, só a positiva", () => {
  const data = divorcio();
  const round = {
    ...must(data.rounds[0]),
    requirements: [req("a", { basis: "" })],
  };
  assert.match(noteProblems(round)[0] ?? "", /fundamento/);
  const done = { ...round, requirements: [req("a", { status: "cumprida" })] };
  assert.match(noteProblems(done)[0] ?? "", /positiva/);
  assert.deepEqual(positiveProblems(done), []);
  assert.match(positiveProblems(round)[0] ?? "", /1 exigência pendente/);
});

test("o reexame diz o que foi atendido, o que permanece e avisa da exigência nova sem documento novo", () => {
  let data = divorcio();
  data.rounds[0] = {
    ...must(data.rounds[0]),
    result: "exigencia",
    requirements: [req("a"), req("b"), req("c")],
  };
  assert.equal(statusOf(data), "exigencia");
  data = openReexam(data, "2026-11-20", "Certidão de casamento atualizada");
  assert.equal(statusOf(data), "reapresentado");
  const round = must(data.rounds[1]);
  assert.equal(round.n, 2);
  assert.deepEqual(
    round.requirements.map((r) => r.id),
    ["a", "b", "c"],
  );
  must(round.requirements[0]).status = "cumprida";
  must(round.requirements[1]).status = "parcial";
  must(round.requirements[1]).note =
    "Veio a certidão, falta a averbação anterior.";
  round.requirements.push(
    req("d", { round: 2 }),
    req("e", { round: 2, fromNewDocument: true }),
  );
  const view = reexamView(data);
  assert.deepEqual(
    view.met.map((r) => r.id),
    ["a"],
  );
  assert.deepEqual(
    view.remaining.map((r) => r.id),
    ["b", "c"],
  );
  assert.deepEqual(
    view.added.map((r) => r.id),
    ["d", "e"],
  );
  assert.equal(view.warnings.length, 1);
  assert.match(view.warnings[0] ?? "", /Exigência d.*art\. 198/);
  assert.deepEqual(providencias(round), [
    "1. Apresentar o documento b. (cumprida em parte)",
    "2. Apresentar o documento c.",
    "3. Apresentar o documento d.",
    "4. Apresentar o documento e.",
  ]);
  const note = buildNote(TENANT, {
    number: "2/2026",
    data,
    roundIndex: 1,
    issuedOn: "2026-11-21",
    signer: { name: "Preposto Fictício", role: "Escrevente" },
  });
  const headings = note.sections.map((s) => s.heading);
  assert.ok(headings.includes("Reexame após reapresentação"));
  assert.ok(headings.includes("Exigências atendidas"));
  assert.ok(headings.includes("Exigências que permanecem"));
  assert.ok(headings.includes("Exigências novas"));
  assert.equal(note.signee, "Preposto Fictício");
  assert.match(JSON.stringify(note), /Cumprida em parte: Veio a certidão/);
});

test("a qualificação positiva diz que o título está apto ao ato", () => {
  const data = divorcio();
  const doc = buildPositive(TENANT, {
    number: "1/2026",
    data,
    issuedOn: "2026-11-12",
  });
  assert.equal(doc.title, "Qualificação positiva nº 1/2026");
  assert.match(
    JSON.stringify(doc),
    /apto a averbação de divórcio ou separação/,
  );
});

test("a biblioteca inicial do Registro Civil é genérica, completa e serve aos atos certos", () => {
  const keys = LIBRARY_SEEDS.map((s) => s.key);
  assert.deepEqual(keys, [...new Set(keys)]);
  const rcpn = seedsOf("rcpn");
  assert.ok(rcpn.length >= 15);
  for (const seed of rcpn) {
    for (const act of seed.acts)
      assert.ok(ACTS.rcpn[act], `${seed.key}: ${act}`);
    assert.ok(seed.title && seed.description && seed.howToComply && seed.basis);
    // No client data: no CPF, no names with surnames in the seeds.
    assert.doesNotMatch(
      `${seed.description} ${seed.howToComply}`,
      /\d{3}\.\d{3}\.\d{3}-\d{2}/,
    );
  }
  // Every attribution of the office starts with its own library.
  for (const attribution of Object.keys(ACTS) as (keyof typeof ACTS)[]) {
    const seeds = seedsOf(attribution);
    assert.ok(seeds.length >= 3, attribution);
    for (const seed of seeds) {
      for (const act of seed.acts) {
        assert.ok(ACTS[attribution][act], `${seed.key}: ${act}`);
      }
    }
  }
  const forDivorce = rcpn
    .filter((s) => servesAct(s, "divorcio"))
    .map((s) => s.key);
  assert.ok(forDivorce.includes("rcpn-divorcio-titulo"));
  assert.ok(forDivorce.includes("rcpn-identificacao"));
  assert.ok(!forDivorce.includes("rcpn-obito-atestado"));
});

test("prazo por atribuição: o da lei como sugestão, o da serventia quando definido, em dias úteis", async () => {
  const { qualificationDeadline, ruleFor, parseDeadlineSettings } =
    await import("./prazos.ts");
  const ri = { ...divorcio(), attribution: "ri" as const, act: "registro" };
  // Friday 2026-11-13: ten business days later, skipping weekends.
  ri.receivedOn = "2026-11-13";
  const state = qualificationDeadline(ri, {}, "2026-11-20");
  assert.ok(state);
  assert.equal(state?.late, false);
  assert.ok((state?.due ?? "") >= "2026-11-27");
  assert.equal(qualificationDeadline(divorcio(), {}, "2026-11-20"), null);
  const own = parseDeadlineSettings({ rcpn: 5, ri: null, x: 3, notas: 0 });
  assert.deepEqual(own, { rcpn: 5, ri: null });
  assert.equal(ruleFor("rcpn", own).days, 5);
  assert.equal(ruleFor("ri", own).days, null);
  assert.ok(qualificationDeadline(divorcio(), own, "2026-12-30")?.late);
  // Answered by a note: no term running.
  const answered = divorcio();
  answered.rounds[0] = { ...must(answered.rounds[0]), result: "exigencia" };
  assert.equal(qualificationDeadline(answered, own, "2026-12-30"), null);
});

test("cada assunto do campo Tirar dúvida tem tema e a permissão da própria tela", async () => {
  const { QUESTION_TOPICS, isQuestionTopic } = await import(
    "../assistente/duvidas.ts"
  );
  const { OFFICE_PERMISSIONS } = await import("../auth/roles.ts");
  for (const [key, topic] of Object.entries(QUESTION_TOPICS)) {
    assert.ok(isQuestionTopic(key));
    assert.ok(topic.scope.length > 40, key);
    assert.ok(
      (OFFICE_PERMISSIONS as readonly string[]).includes(topic.permission),
      key,
    );
  }
  assert.equal(isQuestionTopic("qualquer-coisa"), false);
});
