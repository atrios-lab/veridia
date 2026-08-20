import { z } from "zod";
import type { NoticeSector } from "../tenant/gating.ts";
import { NOTICE_SECTOR_ATTRIBUTION } from "../tenant/gating.ts";

/**
 * What a serventia publishes: marriage banns (proclamas), a general notice
 * (aviso), or a formal notice (edital). Banns and editais also feed the
 * public `/editais` page, grouped by sector; a notice is home-only content
 * and never carries one.
 */
export const PUBLICATION_KINDS = [
  "marriageBanns",
  "notice",
  "publicNotice",
] as const;
export const PublicationKindSchema = z.enum(PUBLICATION_KINDS);
export type PublicationKind = z.infer<typeof PublicationKindSchema>;

export const PUBLICATION_KIND_LABELS: Record<PublicationKind, string> = {
  marriageBanns: "Proclamas",
  notice: "Aviso",
  publicNotice: "Edital",
};

// "YYYY-MM-DD", same discipline as IsoDate in src/core/scheduling/calendar.ts:
// a publication enters and leaves the site on a day on the wall calendar, not
// at a server instant.
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

const NoticeSectorSchema = z.enum(
  Object.keys(NOTICE_SECTOR_ATTRIBUTION) as [NoticeSector, ...NoticeSector[]],
);

/**
 * The form's input. `publishAt` absent means "save as draft": everything
 * else about the publication can be filled in before it is ever scheduled.
 * `expireAt` is required only once `publishAt` is set: a draft has no exit
 * date to validate yet.
 *
 * A factory, not a constant, because the sector question depends on who is
 * asking: banns are always `proclamas` and never ask; an edital must pick
 * one of the sectors this office's attributions allow; a notice is home-only
 * and carries none. The allowed list comes from `noticeSectors(tenant)` at
 * the single server call site: hiding an option in the form is not what
 * enforces it.
 */
export function publicationFormSchema(allowedSectors: readonly NoticeSector[]) {
  return z
    .object({
      kind: PublicationKindSchema,
      sector: NoticeSectorSchema.optional(),
      title: z
        .string()
        .trim()
        .min(1, "Informe o título.")
        .max(200, "Título longo demais."),
      body: z.string().trim().min(1, "Informe o texto."),
      publishAt: isoDate.optional(),
      expireAt: isoDate.optional(),
    })
    .superRefine((v, ctx) => {
      if (v.kind === "publicNotice") {
        if (!v.sector) {
          ctx.addIssue({
            code: "custom",
            path: ["sector"],
            message: "Informe o setor do edital.",
          });
        } else if (!allowedSectors.includes(v.sector)) {
          ctx.addIssue({
            code: "custom",
            path: ["sector"],
            message: "Esta serventia não publica editais desse setor.",
          });
        }
      }
    })
    .transform((v) => ({
      ...v,
      // Banns always belong to proclamas; a notice never has a sector. Set
      // here, not in the UI, so no crafted POST can say otherwise.
      sector:
        v.kind === "marriageBanns"
          ? ("proclamas" as const)
          : v.kind === "notice"
            ? null
            : (v.sector ?? null),
    }))
    .refine((v) => !v.publishAt || v.expireAt, {
      message: "Informe a data de saída para publicar.",
      path: ["expireAt"],
    })
    .refine((v) => !v.publishAt || !v.expireAt || v.expireAt >= v.publishAt, {
      message: "A data de saída tem de ser igual ou depois da data de entrada.",
      path: ["expireAt"],
    });
}

export type PublicationFormInput = z.infer<
  ReturnType<typeof publicationFormSchema>
>;

export interface Publication {
  id: string;
  tenantSlug: string;
  kind: PublicationKind;
  /** Null on notices and on rows older than the sector column. */
  sector: NoticeSector | null;
  title: string;
  body: string;
  /** Null while a draft: see publicationFormSchema. */
  publishAt: string | null;
  expireAt: string | null;
  /** Set only by manual archiving; automatic expiry never writes this. */
  archivedAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}
