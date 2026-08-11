import { z } from "zod";

/**
 * A public transparency document: a PDF the office publishes on the site to
 * meet the Lei de Acesso à Informação: a fee table, a cost table, a notice.
 *
 * Its life is upload → draft → published → (unpublished). Unlike a
 * publication, it has no dates: it goes up and comes down by hand, and the
 * order it sits in on the panel is the order it appears on the site, so
 * position is a first-class field, not a sort by time.
 */

/** The three states a document moves through. State is stored, not computed:
 * there are no dates to derive it from: see design.md. */
export const DOCUMENT_STATUSES = ["draft", "published", "unpublished"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  draft: "Rascunho",
  published: "Publicado",
  unpublished: "Despublicado",
};

/**
 * The categories the upload form offers. A fixed list, not free text: the
 * public page groups by it, and "Tabela de emolumentos" typed five ways is
 * five groups. Adding one is a line here: see design.md, Open Questions.
 */
export const DOCUMENT_CATEGORIES = [
  "Tabela de emolumentos",
  "Tabela de custas",
  "Relatório de gestão",
  "Aviso",
  "Outro",
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export function isDocumentCategory(value: string): value is DocumentCategory {
  return (DOCUMENT_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Whether a state change the panel offers is legal. Publish takes a draft or
 * an unpublished one up; unpublish takes a published one down. Anything else
 * (publishing what is already published) is a no-op the UI should not have
 * offered, and the server refuses rather than writing a redundant audit line.
 */
export function canPublish(status: DocumentStatus): boolean {
  return status === "draft" || status === "unpublished";
}

export function canUnpublish(status: DocumentStatus): boolean {
  return status === "published";
}

/**
 * The upload form's fields, minus the file itself: the PDF is validated by
 * `storeAttachments` (shared type and size limits), so it never grows a
 * second definition of "a valid file" here. The category is checked against
 * the fixed list: a crafted POST cannot invent a group the public page will
 * not render.
 */
export const documentFormSchema = z.object({
  category: z
    .string()
    .refine(isDocumentCategory, { message: "Categoria inválida." }),
  title: z
    .string()
    .trim()
    .min(1, "Informe o nome do documento.")
    .max(200, "Nome longo demais."),
  yearLabel: z
    .string()
    .trim()
    .min(1, "Informe o ano ou a vigência.")
    .max(80, "Texto longo demais."),
});

export type DocumentFormInput = z.infer<typeof documentFormSchema>;
