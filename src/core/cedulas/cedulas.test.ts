import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type CedulaData,
  CedulaDataSchema,
  cueOf,
  detectChanges,
  detectGuarantees,
  detectKind,
  inferChanges,
  moneyCents,
  planActs,
} from "./analise.ts";
import { KIND_INFO } from "./especies.ts";
import { addendumChanges, allModels, laterModels } from "./minutas.ts";

// Fictitious data only (LGPD): no client of any office.
const cedula = (over: Partial<CedulaData>): CedulaData =>
  CedulaDataSchema.parse({
    kind: "rural-hipotecaria",
    title: "CÉDULA RURAL HIPOTECÁRIA Nº 40/00123-7",
    number: "40/00123-7",
    issuedOn: "10/11/2026",
    amount: "R$ 600.000,00",
    dueOn: "15/09/2030",
    protocolNumber: "1.234",
    protocolDate: "20/11/2026",
    people: [
      {
        role: "emitente",
        name: "João Fictício de Souza",
        taxId: "123.456.789-09",
        qualification: "brasileiro, agricultor",
      },
      {
        role: "credor",
        name: "Banco Exemplo S.A.",
        taxId: "",
        qualification: "",
      },
    ],
    guarantees: [
      {
        kind: "hipoteca",
        grade: "1º",
        description: "imóvel rural com 55 ha",
        registration: "matrícula nº 9.999",
        here: "sim",
      },
    ],
    ...over,
  });
const place = { city: "Ielmo Marinho", state: "RN" };

test("cédula rural: sem inscrição própria desde 2020, só a hipoteca na matrícula", () => {
  const plan = planActs(cedula({}));
  assert.equal(plan.family, "rural");
  assert.deepEqual(
    plan.acts.map((a) => [a.nature, a.where]),
    [["registro", "matricula"]],
  );
  assert.match(plan.cedulaBasis, /Lei nº 13\.986\/2020/);
  assert.match(plan.divergence ?? "", /Caderno IRIB nº 9/);
  assert.equal(plan.deadline, "10 dias");
  assert.ok(plan.rules.some((r) => /0,3%/.test(r)));
});

test("cédula industrial: Livro nº 3, hipoteca na matrícula e remissões, 3 dias úteis", () => {
  const plan = planActs(cedula({ kind: "credito-industrial" }));
  assert.deepEqual(
    plan.acts.map((a) => a.model),
    ["cedula-livro-3", "hipoteca-matricula", "remissao"],
  );
  assert.equal(plan.deadline, "3 dias úteis");
  assert.equal(plan.divergence, undefined);
});

test("CPR: registro na entidade do Banco Central e penhor no Livro nº 3", () => {
  const plan = planActs(
    cedula({
      kind: "produto-rural",
      guarantees: [
        {
          kind: "penhor",
          grade: "1º",
          description: "300 sacas de milho",
          registration: "",
          location: "Sítio Exemplo, matrícula nº 1.111",
          municipality: "Ielmo Marinho/RN",
          here: "sim",
          owner: "",
        },
      ],
    }),
  );
  const [entity, pledge, location] = plan.acts;
  assert.equal(entity?.where, "entidade-registradora");
  assert.equal(entity?.elsewhere, true);
  assert.equal(pledge?.model, "penhor-livro-3");
  assert.equal(location?.optional, true);
  assert.equal(plan.deadline, "3 dias úteis");
});

test("CCI: averbação da emissão com série e custodiante; CCB: só a garantia", () => {
  const cci = planActs(cedula({ kind: "credito-imobiliario" }));
  assert.deepEqual(
    cci.acts.map((a) => a.model),
    ["averbacao-emissao-cci"],
  );
  assert.ok(
    cci.warnings.some((w) => /série e a instituição custodiante/.test(w)),
  );
  const ccb = planActs(cedula({ kind: "credito-bancario" }));
  assert.deepEqual(
    ccb.acts.map((a) => a.model),
    ["hipoteca-matricula"],
  );
  assert.equal(ccb.deadline, "15 dias");
});

test("bem fora da circunscrição: o ato cabe ao outro cartório", () => {
  const plan = planActs(
    cedula({
      guarantees: [
        {
          kind: "hipoteca",
          grade: "1º",
          description: "fazenda",
          registration: "matrícula nº 5",
          location: "",
          municipality: "Macaíba/RN",
          here: "nao",
          owner: "",
        },
      ],
    }),
  );
  assert.equal(plan.acts[0]?.elsewhere, true);
  assert.equal(plan.acts[0]?.charge, "nenhum");
  assert.ok(plan.warnings.some((w) => /fora desta circunscrição/.test(w)));
});

test("aditivo só de prazo na cédula rural: averbação sem conteúdo econômico", () => {
  const plan = planActs(
    cedula({
      addenda: [
        {
          title: "1º aditivo",
          date: "01/12/2026",
          changes: ["prazo"],
          previousDue: "15/09/2030",
          newDue: "15/09/2031",
          previousAmount: "",
          newAmount: "",
          guaranteeChange: "",
          description: "",
        },
      ],
    }),
  );
  const act = plan.acts.find((a) => a.addendumIndex === 0);
  assert.equal(act?.nature, "averbacao");
  assert.equal(act?.charge, "sem-conteudo");
  assert.equal(act?.optional, true);
  assert.match(act?.basis ?? "", /art\. 62/);
  assert.match(act?.basis ?? "", /§ 2º, II, c/);
});

test("aditivo com crédito suplementar e bem novo: registro da garantia e base no suplementar", () => {
  const addendum = {
    title: "2º aditivo",
    date: "01/12/2026",
    changes: ["garantia-inclusao" as const],
    previousDue: "",
    newDue: "",
    previousAmount: "R$ 600.000,00",
    newAmount: "R$ 750.000,00",
    guaranteeChange: "imóvel da matrícula nº 7.777",
    description: "",
  };
  assert.deepEqual(inferChanges(addendum), [
    "valor-aumento",
    "garantia-inclusao",
  ]);
  const data = cedula({
    addenda: [{ ...addendum, changes: inferChanges(addendum) }],
  });
  const acts = planActs(data).acts.filter((a) => a.addendumIndex === 0);
  assert.deepEqual(
    acts.map((a) => [a.nature, a.charge]),
    [
      ["registro", "valor-credito"],
      ["averbacao", "valor-suplementar"],
    ],
  );
  assert.match(
    addendumChanges(data.addenda[0] as never).join("; "),
    /acréscimo de R\$\s150\.000,00/,
  );
});

test("aditivo de CCB comum com aumento: ato com conteúdo financeiro; na industrial, à margem da inscrição", () => {
  const addendum = {
    title: "aditivo",
    date: "",
    changes: ["valor-aumento" as const],
    previousDue: "",
    newDue: "",
    previousAmount: "",
    newAmount: "",
    guaranteeChange: "",
    description: "",
  };
  const ccb = planActs(
    cedula({ kind: "credito-bancario", addenda: [addendum] }),
  );
  assert.equal(
    ccb.acts.find((a) => a.addendumIndex === 0)?.charge,
    "conteudo-financeiro",
  );
  const industrial = planActs(
    cedula({ kind: "credito-industrial", addenda: [addendum] }),
  );
  const act = industrial.acts.find((a) => a.addendumIndex === 0);
  assert.equal(act?.where, "livro-3");
  assert.match(act?.basis ?? "", /arts\. 12 e 36/);
});

test("a espécie vem do título; o que a serventia ensinou vem antes", () => {
  assert.equal(
    detectKind("CÉDULA RURAL PIGNORATÍCIA E HIPOTECÁRIA Nº 9")?.kind,
    "rural-pignoraticia-hipotecaria",
  );
  assert.equal(
    detectKind("Cédula de Crédito à Exportação")?.kind,
    "credito-exportacao",
  );
  assert.equal(detectKind("CPR financeira nº 1")?.kind, "produto-rural");
  assert.equal(detectKind("contrato qualquer"), null);
  const taught = detectKind("CÉDULA DE CRÉDITO RURAL PRONAF Nº 12", [
    { cue: "cedula de credito rural pronaf", kind: "rural-pignoraticia" },
  ]);
  assert.deepEqual(taught, {
    kind: "rural-pignoraticia",
    by: "aprendido",
    cue: "cedula de credito rural pronaf",
  });
});

test("o aprendizado guarda só as palavras do título, sem número nem nome", () => {
  assert.equal(
    cueOf("CÉDULA RURAL PIGNORATÍCIA Nº 40/00123-7"),
    "cedula rural pignoraticia",
  );
  assert.equal(
    cueOf("Cédula de Crédito Bancário n. 998 - João"),
    "cedula de credito bancario",
  );
  assert.equal(cueOf("123"), "");
});

test("garantias e mudanças sugeridas pelo texto, para o funcionário conferir", () => {
  assert.deepEqual(
    detectGuarantees("em hipoteca cedular e penhor; aval de terceiro"),
    ["hipoteca", "penhor", "pessoal"],
  );
  assert.deepEqual(
    detectChanges(
      "fica prorrogado o vencimento e liberado o crédito suplementar",
    ),
    ["prazo", "valor-aumento"],
  );
  assert.equal(moneyCents("R$ 1.234,5"), 123450);
  assert.equal(moneyCents("sem valor"), null);
});

test("os modelos saem preenchidos e marcam o que falta, sem inventar", () => {
  const models = allModels(cedula({ kind: "credito-industrial" }), place);
  const book = models.find((m) => m.id === "cedula");
  assert.match(book?.text ?? "", /CÉDULA DE CRÉDITO INDUSTRIAL nº 40\/00123-7/);
  assert.match(
    book?.text ?? "",
    /JOÃO FICTÍCIO DE SOUZA, inscrito\(a\) no CPF\/CNPJ sob o nº 123\.456\.789-09/,
  );
  assert.match(book?.text ?? "", /Ielmo Marinho\/RN/);
  const mortgage = models.find((m) => m.id === "g0-hipoteca");
  assert.match(mortgage?.text ?? "", /R\.\[preencher: nº\]\/9999/);
  assert.match(
    mortgage?.text ?? "",
    /REGISTRO DA CÉDULA: R\.\[preencher: nº\] do Livro nº 3/,
  );
  const later = laterModels(cedula({}), place).map((m) => m.id);
  assert.deepEqual(later, [
    "certidao",
    "endosso",
    "liberacao-parcial",
    "cancelamento",
  ]);
  for (const kind of Object.keys(KIND_INFO)) {
    // Every kind plans and draws without throwing.
    allModels(cedula({ kind: kind as CedulaData["kind"] }), place);
  }
});
