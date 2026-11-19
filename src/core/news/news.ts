import { z } from "zod";
import { sniffTeamFile, type TeamFileType } from "../team/team.ts";

/**
 * The office's notice board (mural): what the serventia posts on its site
 * besides the formal notices: community weddings, social events, the
 * correição visits and other news. Pure rules, no I/O (decision of
 * 19/11/2026).
 *
 * Not to be confused with the formal publications (proclamas, avisos e
 * editais), which have entry and exit dates and their own page.
 */

export const NEWS_CATEGORIES = [
  {
    id: "casamento-comunitario",
    label: "Casamento comunitário",
    hint: "Mutirões e cerimônias coletivas de casamento.",
  },
  {
    id: "evento-social",
    label: "Evento social",
    hint: "Ações com a comunidade, campanhas, palestras e homenagens.",
  },
  {
    id: "correicao",
    label: "Correição",
    hint: "Visita ou inspeção do juiz corregedor permanente.",
  },
  {
    id: "outros",
    label: "Outras notícias",
    hint: "Qualquer outro comunicado à comunidade.",
  },
] as const;

export type NewsCategoryId = (typeof NEWS_CATEGORIES)[number]["id"];
export const NEWS_CATEGORY_IDS = NEWS_CATEGORIES.map((c) => c.id) as [
  NewsCategoryId,
  ...NewsCategoryId[],
];

export const categoryLabel = (id: string): string =>
  NEWS_CATEGORIES.find((c) => c.id === id)?.label ?? "Outras notícias";

export const TITLE_MAX = 120;
export const SUMMARY_MAX = 280;
export const BODY_MAX = 5000;
export const MAX_PHOTOS = 8;

const IsoDay = /^\d{4}-\d{2}-\d{2}$/;

/** What the form sends for one post (the files travel apart). */
export const NewsInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Escreva o título da notícia.")
    .max(TITLE_MAX, `O título pode ter até ${TITLE_MAX} letras.`),
  category: z.enum(NEWS_CATEGORY_IDS, "Escolha o tipo da notícia."),
  /** The day the event happened or will happen; empty when it has none. */
  eventDate: z
    .string()
    .refine((v) => v === "" || IsoDay.test(v), "Data do evento inválida."),
  summary: z
    .string()
    .trim()
    .min(10, "Escreva um resumo de uma ou duas frases.")
    .max(SUMMARY_MAX, `O resumo pode ter até ${SUMMARY_MAX} letras.`),
  body: z
    .string()
    .trim()
    .max(BODY_MAX, `O texto pode ter até ${BODY_MAX} letras.`),
  /** Whether the photos may be shown: the people in them authorised it. */
  imageConsent: z.boolean(),
  /** On the site only when marked. */
  published: z.boolean(),
});
export type NewsInput = z.infer<typeof NewsInputSchema>;

export type NewsFileKind = "photo" | "pdf";

/** One stored file of a post, as the panel reads it. */
export interface NewsFileRecord {
  id: string;
  kind: NewsFileKind;
  name: string;
  position: number;
}

/** One post as the panel reads it. */
export interface NewsRecord {
  id: string;
  title: string;
  category: string;
  /** "2026-11-19" or null. */
  eventDate: string | null;
  summary: string;
  body: string;
  published: boolean;
  /** When it first went to the site, ISO, or null. */
  publishedAt: string | null;
  imageConsent: boolean;
  archived: boolean;
  files: NewsFileRecord[];
}

/** One post as the visitor sees it. Never carries a file path. */
export interface PublicNews {
  id: string;
  title: string;
  category: string;
  categoryLabel: string;
  eventDate: string | null;
  publishedAt: string | null;
  summary: string;
  body: string;
  /** Ids of the photos the visitor may open (empty without the consent). */
  photos: string[];
  pdf: { id: string; name: string } | null;
}

/** The visitor's view of a post, or null when it is not on the site. */
export function publicNews(post: NewsRecord): PublicNews | null {
  if (!post.published || post.archived) return null;
  const files = [...post.files].sort((a, b) => a.position - b.position);
  const pdf = files.find((f) => f.kind === "pdf");
  return {
    id: post.id,
    title: post.title,
    category: post.category,
    categoryLabel: categoryLabel(post.category),
    eventDate: post.eventDate,
    publishedAt: post.publishedAt,
    summary: post.summary,
    body: post.body,
    // A photo of people is shown only with the authorisation recorded.
    photos: post.imageConsent
      ? files.filter((f) => f.kind === "photo").map((f) => f.id)
      : [],
    pdf: pdf ? { id: pdf.id, name: pdf.name } : null,
  };
}

/**
 * The newest first: by the event's day, else by the day it went to the
 * site; the title breaks a tie so the order never flickers.
 */
export function newestFirst<
  T extends {
    eventDate: string | null;
    publishedAt: string | null;
    title: string;
  },
>(posts: readonly T[]): T[] {
  const day = (p: T) => p.eventDate ?? p.publishedAt?.slice(0, 10) ?? "";
  return [...posts].sort(
    (a, b) =>
      day(b).localeCompare(day(a)) || a.title.localeCompare(b.title, "pt-BR"),
  );
}

// Files -----------------------------------------------------------------

const MB = 1024 * 1024;

export const NEWS_FILE_RULES: Record<
  NewsFileKind,
  { label: string; types: readonly TeamFileType[]; maxBytes: number }
> = {
  photo: { label: "foto", types: ["png", "jpeg", "webp"], maxBytes: 3 * MB },
  pdf: { label: "anexo em PDF", types: ["pdf"], maxBytes: 6 * MB },
};

export const NEWS_MIME: Record<"png" | "jpeg" | "webp" | "pdf", string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
};

/** The problem with a file for this slot, in words, or the type it is. */
export function checkNewsFile(
  kind: NewsFileKind,
  bytes: Uint8Array,
  fileName: string,
):
  | { ok: true; type: "png" | "jpeg" | "webp" | "pdf" }
  | { ok: false; message: string } {
  const rule = NEWS_FILE_RULES[kind];
  if (bytes.byteLength === 0) {
    return { ok: false, message: `O arquivo da ${rule.label} está vazio.` };
  }
  if (bytes.byteLength > rule.maxBytes) {
    return {
      ok: false,
      message: `A ${rule.label} pode ter até ${Math.round(rule.maxBytes / MB)} MB.`,
    };
  }
  const type = sniffTeamFile(bytes, fileName);
  if (
    !type ||
    !rule.types.includes(type) ||
    !(type === "png" || type === "jpeg" || type === "webp" || type === "pdf")
  ) {
    return {
      ok: false,
      message:
        kind === "photo"
          ? "Envie a foto em PNG, JPEG ou WebP."
          : "Envie o anexo em PDF.",
    };
  }
  return { ok: true, type };
}

/** Shown, and agreed to, when a PDF is attached: it is open to the visitor. */
export const NEWS_PDF_PUBLIC_WARNING =
  "Este arquivo fica público: quem entra no site pode abrir. Confira se não tem CPF, endereço ou outros dados pessoais.";

/**
 * What the correição post may say. The Livro de Visitas e Correições is
 * written by the judicial authority, never by the delegatário (CNN, art.
 * 187, parágrafo único): the post only informs that the visit happened.
 */
export const CORREICAO_NOTE =
  "A correição é registrada pela autoridade judiciária no Livro de Visitas e Correições. Aqui, só informe que a visita aconteceu e, se quiser, o resultado geral. Não publique dados pessoais nem o conteúdo da ata.";
