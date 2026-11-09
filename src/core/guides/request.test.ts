import assert from "node:assert/strict";
import { test } from "node:test";
import { cartorioMarinho } from "../tenant/tenants/marinho.ts";
import { guideFromRequest, PublicGuideRequestSchema } from "./request.ts";
import { GuideSchema } from "./schema.ts";
import { defaultGuideSettings } from "./settings.ts";

const request = {
  kind: "itiv" as const,
  nature: "",
  parties: [
    {
      role: "transmitente" as const,
      name: "João Fictício de Souza",
      gender: "masculino" as const,
      taxId: "123.456.789-09",
      civilStatus: "casado" as const,
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
  // A certidão do IPTU needs neither a buyer nor a value.
  assert.equal(
    PublicGuideRequestSchema.safeParse({
      ...request,
      kind: "certidao-imobiliaria",
      parties: [request.parties[0]],
      declaredValueCents: 0,
    }).success,
    true,
  );
});
