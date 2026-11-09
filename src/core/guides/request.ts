import { z } from "zod";
import { GUIDE_KIND_INFO } from "./catalog.ts";
import {
  CIVIL_STATUSES,
  emptyParty,
  GUIDE_KINDS,
  type Guide,
  type GuideKind,
  GuidePartySchema,
  type GuideSettings,
  rateFor,
} from "./schema.ts";

/**
 * What the citizen fills on the site to ask for a guia: the simplified form
 * (the product's decision of 09/11/2026: no reading of documents, a short
 * form, the guia drawn by itself). It becomes a full `Guide` with
 * `guideFromRequest`, and the office corrects anything on the panel before
 * signing.
 */

const text = (max: number, required?: string) =>
  required
    ? z.string().trim().min(1, required).max(max, `Use até ${max} caracteres.`)
    : z.string().trim().max(max, `Use até ${max} caracteres.`);

export const PublicGuidePartySchema = z.object({
  role: z.enum(["transmitente", "adquirente"]),
  name: text(160, "Informe o nome completo."),
  gender: z.enum(["feminino", "masculino"]),
  taxId: GuidePartySchema.shape.taxId.refine(
    (value) => value.replace(/\D/g, "").length > 0,
    { message: "Informe o CPF ou o CNPJ." },
  ),
  civilStatus: z.enum(CIVIL_STATUSES).optional(),
  profession: text(80),
  address: text(300, "Informe o endereço."),
});
export type PublicGuideParty = z.infer<typeof PublicGuidePartySchema>;

export const PublicGuideRequestSchema = z
  .object({
    kind: z.enum(GUIDE_KINDS),
    nature: text(120),
    parties: z.array(PublicGuidePartySchema).max(20, "Use até 20 pessoas."),
    property: z.object({
      type: z.enum(["urbano", "rural"]),
      description: text(4000, "Descreva o imóvel (endereço, área)."),
      fiscalRegistration: text(120),
      registration: text(500),
    }),
    declaredValueCents: z
      .number()
      .int()
      .min(0, "Valor inválido.")
      .max(100_000_000_000, "Valor alto demais."),
  })
  .superRefine((request, ctx) => {
    const info = GUIDE_KIND_INFO[request.kind];
    for (const role of ["transmitente", "adquirente"] as const) {
      if (info.rate === "none" && role === "adquirente") continue;
      if (!request.parties.some((party) => party.role === role)) {
        ctx.addIssue({
          code: "custom",
          path: ["parties"],
          message: `Informe ao menos um(a) ${info.roles[role].toLocaleLowerCase("pt-BR")}.`,
        });
      }
    }
    if (info.rate !== "none" && request.declaredValueCents <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["declaredValueCents"],
        message: "Informe o valor declarado do imóvel.",
      });
    }
  });
export type PublicGuideRequest = z.infer<typeof PublicGuideRequestSchema>;

/** The guia as the panel holds it, from what the citizen filled. */
export function guideFromRequest(
  request: PublicGuideRequest,
  settings: GuideSettings,
): Guide {
  const info = GUIDE_KIND_INFO[request.kind];
  return {
    kind: request.kind,
    parties: request.parties.map((party) => ({
      ...emptyParty(party.role),
      personType:
        party.taxId.replace(/\D/g, "").length === 14 ? "juridica" : "fisica",
      name: party.name,
      gender: party.gender,
      nationality: party.gender === "feminino" ? "brasileira" : "brasileiro",
      civilStatus: party.civilStatus,
      profession: party.profession,
      taxId: party.taxId,
      address: party.address,
    })),
    property: request.property,
    nature: request.nature || (info.natures[0] ?? ""),
    declaredValueCents: request.declaredValueCents,
    rateBasisPoints: rateFor(request.kind as GuideKind, settings),
    manualRate: false,
    taxOverrideCents: null,
    addresseeText: "",
    lawText: "",
    notes: "",
    signer: 0,
  };
}
