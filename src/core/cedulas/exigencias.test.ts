import assert from "node:assert/strict";
import { test } from "node:test";
import { qualificationProblems } from "../qualificacao/qualificacao.ts";
import { type CedulaData, CedulaDataSchema, planActs } from "./analise.ts";
import {
  isoDay,
  qualificationFromCedula,
  suggestRequirements,
} from "./exigencias.ts";

// Fictitious data only (LGPD).
const cedula = (over: Partial<CedulaData>): CedulaData =>
  CedulaDataSchema.parse({
    kind: "rural-hipotecaria",
    title: "CÉDULA RURAL HIPOTECÁRIA Nº 7",
    number: "7",
    issuedOn: "10/11/2026",
    amount: "R$ 100.000,00",
    dueOn: "10/11/2030",
    protocolNumber: "321",
    protocolDate: "20/11/2026",
    people: [
      {
        role: "emitente",
        name: "João Fictício",
        taxId: "",
        qualification: "brasileiro, solteiro, agricultor",
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
        description: "sítio",
        registration: "matrícula nº 9",
        here: "sim",
      },
    ],
    ...over,
  });
const keys = (data: CedulaData) =>
  suggestRequirements(data, planActs(data)).map((r) => r.key);

test("cédula completa e daqui: nenhuma exigência", () => {
  assert.deepEqual(keys(cedula({})), []);
});

test("faltam requisitos: uma exigência só, com o artigo da espécie", () => {
  const [req] = suggestRequirements(
    cedula({ amount: "", dueOn: "" }),
    planActs(cedula({ amount: "", dueOn: "" })),
  );
  assert.equal(req?.key, "requisitos");
  assert.match(req?.description ?? "", /o valor do crédito e o vencimento/);
  assert.equal(req?.basis, "Decreto-Lei nº 167/1967, art. 20.");
});

test("imóvel sem matrícula, bem de outra circunscrição e falta da outorga do cônjuge", () => {
  const data = cedula({
    people: [
      {
        role: "emitente",
        name: "João Fictício",
        taxId: "",
        qualification: "brasileiro, casado, agricultor",
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
        description: "sítio",
        registration: "",
        location: "",
        municipality: "",
        here: "sim",
        owner: "",
      },
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
  });
  assert.deepEqual(keys(data), [
    "g0-matricula",
    "g0-conjuge",
    "g1-competencia",
  ]);
  const all = suggestRequirements(data, planActs(data));
  assert.equal(
    all.find((r) => r.key === "g0-conjuge")?.basis,
    "Código Civil, art. 1.647, I.",
  );
  assert.equal(
    all.find((r) => r.key === "g1-competencia")?.basis,
    "Lei nº 6.015/1973, art. 169.",
  );
  // With the spouse's consent, no exigência.
  assert.ok(
    !keys({
      ...data,
      people: [
        ...data.people,
        { role: "conjuge", name: "Ana Fictícia", taxId: "", qualification: "" },
      ],
    }).includes("g0-conjuge"),
  );
});

test("nunca pede CCIR, ITR nem CND, que a lei veda nas cédulas", () => {
  const all = suggestRequirements(
    cedula({ amount: "" }),
    planActs(cedula({ amount: "" })),
  );
  assert.ok(
    all.every(
      (r) =>
        !/CCIR|ITR|CND|certidão negativa/i.test(`${r.title} ${r.howToComply}`),
    ),
  );
});

test("CCI sem série e sem garantia; nota de crédito rural sem ato", () => {
  assert.deepEqual(
    keys(cedula({ kind: "credito-imobiliario", guarantees: [] })),
    ["cci-serie", "cci-garantia"],
  );
  assert.deepEqual(
    keys(cedula({ kind: "nota-credito-rural", guarantees: [] })),
    ["sem-ato"],
  );
});

test("a nota vira uma qualificação de Registro de Imóveis já conferida", () => {
  const data = cedula({ amount: "" });
  const plan = planActs(data);
  let n = 0;
  const q = qualificationFromCedula({
    data,
    plan,
    presenter: "Banco Exemplo S.A.",
    protocol: "",
    today: "2026-11-21",
    requirements: suggestRequirements(data, plan),
    newId: () => `id-${++n}`,
  });
  assert.equal(q.attribution, "ri");
  assert.equal(q.act, "registro");
  assert.equal(q.protocol, "321");
  assert.equal(q.receivedOn, "2026-11-20");
  assert.match(
    q.document,
    /Cédula Rural Hipotecária nº 7, emitida em 10\/11\/2026, credor Banco Exemplo S\.A\./,
  );
  assert.equal(q.rounds[0]?.requirements.length, 1);
  assert.equal(q.rounds[0]?.requirements[0]?.reviewed, true);
  assert.deepEqual(qualificationProblems(q), []);
  assert.equal(isoDay("5/1/2027"), "2027-01-05");
  assert.equal(isoDay("sem data"), "");
});

test("aditivo que não diz o que muda: sem valor declarado e exigência para ciência do requerente", () => {
  const data = cedula({
    addenda: [
      {
        title: "2º aditivo",
        date: "",
        changes: [],
        previousDue: "",
        newDue: "",
        previousAmount: "",
        newAmount: "",
        guaranteeChange: "",
        description: "",
      },
    ],
  });
  const plan = planActs(data);
  const act = plan.acts.find((a) => a.addendumIndex === 0);
  assert.equal(act?.charge, "sem-conteudo");
  assert.match(act?.how?.[0] ?? "", /O que mudou: não está claro/);
  assert.match(
    act?.how?.[1] ?? "",
    /sem valor declarado.*abra a nota de exigência.*ciência do requerente/,
  );
  const req = suggestRequirements(data, plan).find(
    (r) => r.key === "a0-esclarecer",
  );
  assert.equal(req?.title, "Alterações do aditivo");
  assert.match(req?.basis ?? "", /Lei nº 6\.015\/1973, arts\. 198 e 246/);
});

test("aditivo claro diz o que mudou e não gera exigência", () => {
  const data = cedula({
    addenda: [
      {
        title: "1º aditivo",
        date: "",
        changes: ["prazo"],
        previousDue: "10/11/2030",
        newDue: "10/11/2031",
        previousAmount: "",
        newAmount: "",
        guaranteeChange: "",
        description: "",
      },
    ],
  });
  const plan = planActs(data);
  const act = plan.acts.find((a) => a.addendumIndex === 0);
  assert.ok(
    act?.how?.some(
      (s) =>
        s ===
        "O que mudou: prazo: o vencimento passou de 10/11/2030 para 10/11/2031.",
    ),
  );
  assert.ok(act?.how?.some((s) => /averbação sem valor declarado/.test(s)));
  assert.deepEqual(
    suggestRequirements(data, plan).map((r) => r.key),
    [],
  );
});
