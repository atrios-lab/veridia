import { z } from "zod";

/**
 * What a serventia publishes to the "Proclamas e avisos" home section:
 * marriage banns (proclamas), a general notice (aviso), or a formal notice
 * (edital). Not the same thing as the `editais` public section, which is a
 * different, attribution-gated feature — see design.md, Context.
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

/**
 * The form's input. `publishAt` absent means "save as draft" — everything
 * else about the publication can be filled in before it is ever scheduled.
 * `expireAt` is required only once `publishAt` is set: a draft has no exit
 * date to validate yet.
 */
export const publicationFormSchema = z
  .object({
    kind: PublicationKindSchema,
    title: z
      .string()
      .trim()
      .min(1, "Informe o título.")
      .max(200, "Título longo demais."),
    body: z.string().trim().min(1, "Informe o texto."),
    publishAt: isoDate.optional(),
    expireAt: isoDate.optional(),
  })
  .refine((v) => !v.publishAt || v.expireAt, {
    message: "Informe a data de saída para publicar.",
    path: ["expireAt"],
  })
  .refine((v) => !v.publishAt || !v.expireAt || v.expireAt >= v.publishAt, {
    message: "A data de saída tem de ser igual ou depois da data de entrada.",
    path: ["expireAt"],
  });

export type PublicationFormInput = z.infer<typeof publicationFormSchema>;

export interface Publication {
  id: string;
  tenantSlug: string;
  kind: PublicationKind;
  title: string;
  body: string;
  /** Null while a draft — see publicationFormSchema. */
  publishAt: string | null;
  expireAt: string | null;
  /** Set only by manual archiving; automatic expiry never writes this. */
  archivedAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}
