import { z } from "zod";
import type { NoticeSector } from "../tenant/gating.ts";
import { NOTICE_SECTOR_ATTRIBUTION } from "../tenant/gating.ts";
import {
  MARRIAGE_BANNS_NOTICE_TYPE,
  NOTICE_TYPES,
  noticeTypeOf,
} from "./notice-types.ts";

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

// The plural each kind takes in the home section's heading.
const PUBLICATION_KIND_PLURALS: Record<PublicationKind, string> = {
  marriageBanns: "Proclamas",
  notice: "Avisos",
  publicNotice: "Editais",
};

/**
 * The home section's heading, named after what is actually live: only
 * banns reads "Proclamas", only notices "Avisos", an edital alongside a
 * notice "Avisos e editais". A fixed "Proclamas e avisos" over an edital
 * told the citizen something the office never published.
 */
export function publicationSectionTitle(
  kinds: readonly PublicationKind[],
): string {
  const present = PUBLICATION_KINDS.filter((k) => kinds.includes(k)).map(
    (k, i) =>
      i === 0
        ? PUBLICATION_KIND_PLURALS[k]
        : PUBLICATION_KIND_PLURALS[k].toLowerCase(),
  );
  if (present.length === 0) return PUBLICATION_KIND_PLURALS.notice;
  if (present.length === 1) return present[0];
  return `${present.slice(0, -1).join(", ")} e ${present.at(-1)}`;
}

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
      // Which edital, inside the sector: the key of its legal rule in
      // NOTICE_TYPES. Optional: an edital the catalog has no rule for is
      // still published, only without computed dates.
      noticeType: z
        .string()
        .refine((key) => Object.hasOwn(NOTICE_TYPES, key), {
          message: "Tipo de edital desconhecido.",
        })
        .optional(),
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
        } else if (
          v.noticeType &&
          noticeTypeOf(v.noticeType)?.sector !== v.sector
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["noticeType"],
            message: "Esse tipo de edital não pertence ao setor escolhido.",
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
      // Same posture for the edital's type: banns have exactly one rule,
      // a notice has none.
      noticeType:
        v.kind === "marriageBanns"
          ? MARRIAGE_BANNS_NOTICE_TYPE
          : v.kind === "notice"
            ? null
            : (v.noticeType ?? null),
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
  /** Key of NOTICE_TYPES; null on notices and editais with no rule. */
  noticeType: string | null;
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
