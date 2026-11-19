import assert from "node:assert/strict";
import { test } from "node:test";
import { cartorioMarinho } from "../tenant/tenants/marinho.ts";
import { guideFromRequest, PublicGuideRequestSchema } from "./request.ts";
import { GuideSchema } from "./schema.ts";
import { defaultGuideSettings } from "./settings.ts";

const request = {
  kind: "itiv" as const,
  nature: "",
  requester: {
    role: "adquirente" as const,
    mandate: "",
    mandateAttached: false,
  },
  parties: [
    {
      role: "transmitente" as const,
      name: "João Fictício de Souza",
      gender: "masculino" as const,
      taxId: "123.456.789-09",
      civilStatus: "casado" as const,
      marriageRegime: "comunhao-parcial" as const,
      spouseName: "Ana Fictícia de Souza",
      spouseTaxId: "111.444.777-35",
      profession: "funcionário público",
      address: "Avenida Exemplo, 200, Natal/RN",
    },
    {
      role: "adquirente" as const,
      name: "Maria Exemplo da Silva",
      gender: "feminino" as const,
      taxId: "529.982.247-25",
      civilStatus: "solteiro" as const,
      profession: "autônoma",
      address: "Rua das Flores, 100, Natal/RN",
    },
  ],
  property: {
    type: "urbano" as const,
    description: "Rua Projetada, 10, Centro, Ielmo Marinho/RN",
    fiscalRegistration: "",
    registration: "matrícula nº 9.999",
  },
  declaredValueCents: 2_700_000,
};

test("o formulário simples vira a guia completa, com a alíquota da serventia", () => {
  const parsed = PublicGuideRequestSchema.parse(request);
  const guide = guideFromRequest(parsed, defaultGuideSettings(cartorioMarinho));
  assert.equal(GuideSchema.safeParse(guide).success, true);
  assert.equal(guide.rateBasisPoints, 300);
  assert.equal(guide.nature, "compra e venda");
  assert.equal(guide.parties[0]?.nationality, "brasileiro");
  assert.equal(guide.parties[1]?.nationality, "brasileira");
});

test("pede quem transmite, quem adquire, CPF válido e o valor", () => {
  const only = PublicGuideRequestSchema.safeParse({
    ...request,
    parties: [request.parties[0]],
    declaredValueCents: 0,
  });
  assert.equal(only.success, false);
  const messages = only.success ? [] : only.error.issues.map((i) => i.message);
  assert.ok(messages.some((m) => /adquirente/i.test(m)));
  assert.ok(messages.some((m) => /valor declarado/i.test(m)));
  const badCpf = PublicGuideRequestSchema.safeParse({
    ...request,
    parties: [
      { ...request.parties[0], taxId: "111.111.111-12" },
      request.parties[1],
    ],
  });
  assert.equal(badCpf.success, false);
  // The certidão do IPTU is no longer offered: the debt shows with the ITIV.
  assert.equal(
    PublicGuideRequestSchema.safeParse({
      ...request,
      kind: "certidao-imobiliaria",
    }).success,
    false,
  );
});

test("casado pede o cônjuge e o regime; procurador pede o mandato", () => {
  const married = PublicGuideRequestSchema.safeParse({
    ...request,
    parties: [
      {
        ...request.parties[0],
        marriageRegime: undefined,
        spouseName: "",
      },
      request.parties[1],
    ],
  });
  const messages = married.success
    ? []
    : married.error.issues.map((i) => i.message);
  assert.ok(messages.includes("Informe o nome do cônjuge."));
  assert.ok(messages.includes("Escolha o regime de bens."));
  const proxy = (mandate: string, mandateAttached: boolean) =>
    PublicGuideRequestSchema.safeParse({
      ...request,
      requester: { role: "terceiro", mandate, mandateAttached },
    }).success;
  assert.equal(proxy("", false), false);
  assert.equal(proxy("", true), true);
  assert.equal(proxy("Cartório Exemplo, livro 10, fls. 20", false), true);
  assert.equal(
    PublicGuideRequestSchema.safeParse({ ...request, requester: undefined })
      .success,
    false,
  );
});

test("a guia leva o requerente e o cônjuge com regime", () => {
  const parsed = PublicGuideRequestSchema.parse({
    ...request,
    requester: {
      role: "terceiro",
      mandate: "livro 10, fls. 20",
      mandateAttached: false,
    },
  });
  const guide = guideFromRequest(
    parsed,
    defaultGuideSettings(cartorioMarinho),
    {
      name: "Pedro Procurador Fictício",
      cpf: "111.444.777-35",
    },
  );
  assert.deepEqual(guide.requester, {
    role: "terceiro",
    name: "Pedro Procurador Fictício",
    taxId: "111.444.777-35",
    mandate: "livro 10, fls. 20",
  });
  assert.equal(guide.parties[0]?.marriageRegime, "comunhao-parcial");
  assert.match(
    guide.parties[0]?.spouse ?? "",
    /^ANA FICTÍCIA DE SOUZA, CPF nº 111\.444\.777-35$/,
  );
  assert.equal(guide.parties[1]?.spouse, "");
  assert.equal(GuideSchema.safeParse(guide).success, true);
});
