import { z } from "zod";
import { LONG_TEXT_MAX } from "../text-limits.ts";
import { GUIDE_KIND_INFO } from "./catalog.ts";
import {
  CIVIL_STATUSES,
  emptyParty,
  GUIDE_KINDS,
  type Guide,
  type GuideKind,
  GuidePartySchema,
  type GuideRequester,
  type GuideSettings,
  MARRIAGE_REGIMES,
  OFFERED_GUIDE_KINDS,
  rateFor,
  STABLE_UNION_OPTIONS,
} from "./schema.ts";

/**
 * What the citizen fills on the site to ask for a guia: the simplified form
 * (the product's decision of 09/11/2026: no reading of documents, a short
 * form, the guia drawn by itself). It becomes a full `Guide` with
 * `guideFromRequest`, and the office corrects anything on the panel before
 * signing.
 */

const text = (max: number, required?: string) => {
  const tooLong = `Use até ${max.toLocaleString("pt-BR")} caracteres.`;
  return required
    ? z.string().trim().min(1, required).max(max, tooLong)
    : z.string().trim().max(max, tooLong);
};

export const PublicGuidePartySchema = z.object({
  role: z.enum(["transmitente", "adquirente"]),
  name: text(160, "Informe o nome completo."),
  gender: z.enum(["feminino", "masculino"]),
  taxId: GuidePartySchema.shape.taxId.refine(
    (value) => value.replace(/\D/g, "").length > 0,
    { message: "Informe o CPF ou o CNPJ." },
  ),
  civilStatus: z.enum(CIVIL_STATUSES).optional(),
  /** Married: the regime and the spouse (decision of 19/11/2026). */
  marriageRegime: z.enum(MARRIAGE_REGIMES).optional(),
  spouseName: text(160).default(""),
  spouseTaxId: GuidePartySchema.shape.taxId.default(""),
  stableUnion: z.enum(STABLE_UNION_OPTIONS).default("nao-informado"),
  profession: text(80),
  address: text(300, "Informe o endereço."),
});
export type PublicGuideParty = z.input<typeof PublicGuidePartySchema>;

/**
 * How many documents the guia's groups (vendedor, comprador, imóvel,
 * procuração) carry together, each file under the request's own size
 * limit; they go straight to the store, never in the form's body.
 */
export const GUIDE_MAX_FILES = 20;

/**
 * Who is asking, among the people of the deal (decision of 19/11/2026):
 * the buyer, the seller, or someone else by mandato, who then attaches
 * the procuração or says where it was made.
 */
export const PUBLIC_REQUESTER_ROLES = [
  "adquirente",
  "transmitente",
  "terceiro",
] as const;

export const PublicGuideRequesterSchema = z.object({
  role: z.enum(PUBLIC_REQUESTER_ROLES, "Diga quem está pedindo a guia."),
  /** The procuração or the representation, in words. */
  mandate: text(LONG_TEXT_MAX).default(""),
  /** The procuração goes as a file with the request. */
  mandateAttached: z.boolean().default(false),
});

export const PublicGuideRequestSchema = z
  .object({
    // Only what is offered: a new request never asks for the certidão.
    kind: z
      .enum(GUIDE_KINDS)
      .refine((kind) => OFFERED_GUIDE_KINDS.includes(kind), {
        message: "Escolha uma das guias oferecidas.",
      }),
    nature: text(120),
    requester: PublicGuideRequesterSchema,
    parties: z.array(PublicGuidePartySchema).max(20, "Use até 20 pessoas."),
    property: z.object({
      type: z.enum(["urbano", "rural"]),
      description: text(
        LONG_TEXT_MAX,
        "Descreva o bem: imóvel (endereço, área), móvel ou digital.",
      ),
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
    request.parties.forEach((party, index) => {
      if (party.civilStatus !== "casado") return;
      if (!party.spouseName.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["parties", index, "spouseName"],
          message: "Informe o nome do cônjuge.",
        });
      }
      if (!party.marriageRegime) {
        ctx.addIssue({
          code: "custom",
          path: ["parties", index, "marriageRegime"],
          message: "Escolha o regime de bens.",
        });
      }
    });
    if (
      request.requester.role === "terceiro" &&
      !request.requester.mandate.trim() &&
      !request.requester.mandateAttached
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["requester", "mandate"],
        message:
          "Anexe a procuração ou escreva os dados do mandato (cartório, livro, folha e data).",
      });
    }
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
/** What the form builds, before the defaults fill in. */
export type PublicGuideRequestInput = z.input<typeof PublicGuideRequestSchema>;

function formatCpf(value: string): string {
  const d = value.replace(/\D/g, "");
  if (d.length === 11) {
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return value.trim();
}

/** "JOÃO EXEMPLO, inscrito no CPF sob o nº 000.000.000-00" */
function spouseText(party: z.infer<typeof PublicGuidePartySchema>): string {
  const name = party.spouseName.trim().toLocaleUpperCase("pt-BR");
  if (!name) return "";
  // Neutral wording: the spouse's gender is never presumed from the party's.
  return party.spouseTaxId.trim()
    ? `${name}, CPF nº ${formatCpf(party.spouseTaxId)}`
    : name;
}

/** The guia as the panel holds it, from what the citizen filled. */
export function guideFromRequest(
  request: PublicGuideRequest,
  settings: GuideSettings,
  /** Who filed the request: the requerente, named on the paper. */
  applicant: { name: string; cpf?: string | null } = { name: "" },
): Guide {
  const info = GUIDE_KIND_INFO[request.kind];
  const requester: GuideRequester = {
    role: request.requester.role,
    name: applicant.name.trim(),
    taxId: applicant.cpf?.trim() ?? "",
    mandate: request.requester.mandate.trim(),
  };
  return {
    kind: request.kind,
    requester,
    parties: request.parties.map((party) => ({
      ...emptyParty(party.role),
      personType:
        party.taxId.replace(/\D/g, "").length === 14 ? "juridica" : "fisica",
      name: party.name,
      gender: party.gender,
      nationality: party.gender === "feminino" ? "brasileira" : "brasileiro",
      civilStatus: party.civilStatus,
      marriageRegime:
        party.civilStatus === "casado" ? party.marriageRegime : undefined,
      spouse: party.civilStatus === "casado" ? spouseText(party) : "",
      stableUnion: party.stableUnion,
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
