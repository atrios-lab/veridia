import assert from "node:assert/strict";
import { test } from "node:test";
import { cartorioMarinho } from "../tenant/tenants/marinho.ts";
import { GUIDE_KIND_INFO, guideKindsSummary, itcdRn } from "./catalog.ts";
import { buildGuideDocument, guideAmount } from "./document.ts";
import { missingQualification, qualify } from "./qualification.ts";
import {
  formatGuideNumber,
  type Guide,
  type GuideParty,
  GuideSchema,
  OFFERED_GUIDE_KINDS,
  retentionState,
} from "./schema.ts";
import { defaultGuideSettings } from "./settings.ts";

const party = (over: Partial<GuideParty>): GuideParty => ({
  role: "adquirente",
  personType: "fisica",
  name: "Maria Exemplo da Silva",
  gender: "feminino",
  nationality: "brasileira",
  civilStatus: "solteiro",
  marriageRegime: undefined,
  marriageRecord: "",
  stableUnion: "nao",
  profession: "autônoma",
  taxId: "529.982.247-25",
  identity: "",
  filiation: "",
  email: "",
  address: "Rua das Flores, 100, Centro, Natal/RN, CEP 59.000-000",
  representation: "",
  ...over,
});

const itiv: Guide = {
  kind: "itiv",
  parties: [
    party({}),
    party({
      role: "transmitente",
      name: "João Fictício de Souza",
      gender: "masculino",
      nationality: "brasileiro",
      civilStatus: "casado",
      marriageRegime: "comunhao-universal",
      stableUnion: "nao-informado",
      profession: "funcionário público",
      taxId: "123.456.789-09",
      identity: "nº 1.234.567, SSP/RN",
      address: "Avenida Exemplo, 200, Natal/RN",
    }),
  ],
  property: {
    type: "urbano",
    description: "Rua Projetada, 10, Centro, Ielmo Marinho/RN, com 80,00 m².",
    fiscalRegistration: "01.02.0003.0004.0005.0006",
    registration: "matrícula nº 9.999, livro 2-A, fls. 010/012",
  },
  nature: "compra e venda",
  declaredValueCents: 2_700_000,
  rateBasisPoints: 300,
  manualRate: false,
  taxOverrideCents: null,
  addresseeText: "",
  lawText: "",
  notes: "",
  signer: 0,
};

test("a qualificação segue a Lei 6.015, art. 176, e o CPC, art. 319, II", () => {
  assert.equal(
    qualify(party({})),
    "MARIA EXEMPLO DA SILVA, brasileira, solteira, declarante não convivente em união estável, autônoma, inscrita no CPF sob o nº 529.982.247-25, residente e domiciliada na Rua das Flores, 100, Centro, Natal/RN, CEP 59.000-000",
  );
  const married = qualify(itiv.parties[1] as GuideParty);
  assert.match(
    married,
    /^JOÃO FICTÍCIO DE SOUZA, brasileiro, casado sob o regime da comunhão universal de bens, funcionário público, portador da Carteira de Identidade nº 1\.234\.567, SSP\/RN, inscrito no CPF/,
  );
  assert.deepEqual(missingQualification(party({ profession: "" })), [
    "profissão",
  ]);
  assert.deepEqual(
    missingQualification(party({ taxId: "", identity: "", filiation: "" })),
    ["CPF, RG ou, na falta deles, a filiação"],
  );
});

test("CPF com dígito errado é recusado", () => {
  const parsed = GuideSchema.safeParse({
    ...itiv,
    parties: [party({ taxId: "529.982.247-26" })],
  });
  assert.equal(parsed.success, false);
  assert.equal(GuideSchema.safeParse(itiv).success, true);
});

test("ITCD do RN por faixa (Lei 5.887/1989, art. 7º, red. Lei 9.993/2015)", () => {
  assert.equal(itcdRn(1_500_000).taxCents, 45_000); // R$ 15.000 a 3%
  assert.equal(itcdRn(50_000_000).taxCents, 1_500_000); // R$ 500 mil a 3%
  // R$ 1,2 milhão: 15.000 + 20.000 (4% de 500 mil) + 10.000 (5% de 200 mil)
  assert.equal(itcdRn(120_000_000).taxCents, 4_500_000);
  // R$ 4 milhões: 15.000 + 20.000 + 100.000 + 60.000
  assert.equal(itcdRn(400_000_000).taxCents, 19_500_000);
});

test("a guia de ITIV sai como o modelo da serventia", () => {
  const settings = defaultGuideSettings(cartorioMarinho);
  const doc = buildGuideDocument(cartorioMarinho, {
    guide: itiv,
    settings,
    year: 2026,
    sequence: 8,
    issuedOn: "2026-07-15",
  });
  assert.equal(doc.title, "Guia imobiliária nº 008/2026");
  const text = doc.sections
    .flatMap((s) => [
      ...(s.paragraphs ?? []),
      ...(s.rows ?? []).map((r) => `${r.label}: ${r.value}`),
    ])
    .join("\n");
  assert.match(
    text,
    /Secretaria Municipal de Tributação \/ Finanças da Prefeitura Municipal de Ielmo Marinho\/RN \(CNPJ nº 08\.004\.525\/0001-07\)/,
  );
  assert.match(
    text,
    /à alíquota de 3% sobre o valor declarado, conforme Lei Complementar Municipal nº 44/,
  );
  assert.match(text, /por compra e venda, de JOÃO FICTÍCIO DE SOUZA/);
  assert.match(
    text,
    /Valor declarado: R\$ 27\.000,00 \(vinte e sete mil reais\)/,
  );
  assert.match(text, /Imposto estimado: R\$ 810,00 \(oitocentos e dez reais\)/);
  assert.match(text, /Inscrição imobiliária: 01\.02\.0003\.0004\.0005\.0006/);
  assert.equal(doc.dateLine, "Ielmo Marinho/RN, 15 de julho de 2026.");
  assert.equal(doc.signee, "Bel. Joelison Alves Marinho");
});

test("a guia de ITCD por doação vai à SET/RN com a tabela do estado", () => {
  const guide: Guide = {
    ...itiv,
    kind: "itcd-doacao",
    nature: "doação",
    declaredValueCents: 1_500_000,
  };
  const doc = buildGuideDocument(cartorioMarinho, {
    guide,
    settings: defaultGuideSettings(cartorioMarinho),
    year: 2025,
    sequence: 3,
    issuedOn: "2025-02-13",
  });
  const text = JSON.stringify(doc.sections);
  assert.match(
    text,
    /Coordenadoria de Arrecadação, Controle e Estatística \(CACE\)/,
  );
  assert.match(text, /Lei Estadual nº 5\.887/);
  assert.equal(guideAmount(guide).taxCents, 45_000);
  assert.equal(formatGuideNumber(2025, 3), "003/2025");
});

test("tudo ajustável à mão na guia: alíquota, imposto, destinatário e lei", () => {
  const itcd: Guide = {
    ...itiv,
    kind: "itcd-doacao",
    declaredValueCents: 120_000_000,
  };
  assert.equal(guideAmount(itcd).taxCents, 4_500_000); // tabela por faixa
  const manual = { ...itcd, manualRate: true, rateBasisPoints: 200 };
  assert.equal(guideAmount(manual).taxCents, 2_400_000); // 2% à mão
  assert.equal(guideAmount({ ...itiv, rateBasisPoints: 200 }).taxCents, 54_000);
  assert.equal(
    guideAmount({ ...itiv, taxOverrideCents: 70_000 }).taxCents,
    70_000,
  );
  const doc = buildGuideDocument(cartorioMarinho, {
    guide: {
      ...itiv,
      addresseeText: "Ao Setor de ITBI",
      lawText: "Lei Municipal nº 1/2026, art. 5º",
    },
    settings: defaultGuideSettings(cartorioMarinho),
    year: 2026,
    sequence: 9,
    issuedOn: "2026-07-15",
  });
  const text = JSON.stringify(doc.sections);
  assert.match(text, /Ao Setor de ITBI/);
  assert.match(text, /conforme Lei Municipal nº 1\/2026, art\. 5º/);
});

test("guarda de 12 meses: aviso nos últimos 30 dias, depois vencida", () => {
  const issued = new Date("2026-03-10T12:00:00Z");
  assert.equal(
    retentionState(issued, new Date("2026-12-01T12:00:00Z")),
    "kept",
  );
  assert.equal(
    retentionState(issued, new Date("2027-02-20T12:00:00Z")),
    "ending",
  );
  assert.equal(
    retentionState(issued, new Date("2027-03-11T12:00:00Z")),
    "past",
  );
});

test("união estável declarada sob as penas da lei, para quem não é casado", () => {
  for (const civilStatus of [
    "solteiro",
    "viuvo",
    "separado",
    "divorciado",
  ] as const) {
    assert.match(
      qualify(party({ civilStatus, stableUnion: "declara-nao-mantem" })),
      /, que declara, sob as penas da lei, que não mantém união estável, /,
    );
    assert.match(
      qualify(party({ civilStatus, stableUnion: "declara-mantem" })),
      /, que declara, sob as penas da lei, que mantém união estável, /,
    );
  }
  // The wording already in use stays.
  assert.match(
    qualify(party({ stableUnion: "nao" })),
    /declarante não convivente em união estável/,
  );
  assert.doesNotMatch(
    qualify(party({ stableUnion: "nao-informado" })),
    /união estável/,
  );
});

test("o nome Guias imobiliárias lista os tipos do catálogo, sem fixar um imposto", () => {
  const line = guideKindsSummary();
  for (const kind of OFFERED_GUIDE_KINDS) {
    const label = GUIDE_KIND_INFO[kind].label;
    assert.ok(line.toLowerCase().includes(label.toLowerCase()), kind);
  }
  assert.match(line, /transmissão de imóveis/);
  assert.match(line, / e laudêmio municipal\./);
});
