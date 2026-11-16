import { z } from "zod";
import { normsIn } from "../conhecimento/base.ts";
import {
  cleanLearned,
  type LearnedRequirement,
  type ReviewFinding,
} from "./revisao.ts";

/**
 * The review and the learning without the AI (decision of 16/11/2026: "que
 * tenha a opção de buscar na base e na lei que já tem, sem gastar
 * crédito"), and the switch the Átrios account holds over both.
 */

/** How the notes attached to an exigência are reviewed, per office. */
export const NOTE_REVIEW_MODES = {
  ia: {
    label: "Com o Assistente Virtual",
    description:
      "Antes de enviar, o Assistente Virtual lê a nota contra a lei, a base jurídica e os sites oficiais, aponta divergências com o fundamento e sugere manter ou alterar. Aprende com cada nota. Gasta crédito da IA.",
  },
  base: {
    label: "Só pela base jurídica, sem gastar crédito",
    description:
      "Antes de enviar, confere a nota só com o que já está na base jurídica da serventia: norma ou artigo revogado e exigência sem fundamento. É instantâneo. Aprende os modelos pelo texto da nota, sem IA.",
  },
  desligada: {
    label: "Desligada (como era antes)",
    description:
      "Anexa direto, sem análise antes de enviar. Continua aprendendo em segundo plano, pelo texto da nota e sem IA. A IA segue só na qualificação de títulos.",
  },
} as const;
export type NoteReviewMode = keyof typeof NOTE_REVIEW_MODES;
export const isNoteReviewMode = (value: string): value is NoteReviewMode =>
  Object.hasOwn(NOTE_REVIEW_MODES, value);

/**
 * What the Átrios account decides for an office: whether the AI may run
 * there at all (above the Tabelião's own switch) and how notes are
 * reviewed. Absent, everything stays as it was delivered.
 */
export const AiPlatformSchema = z.object({
  aiAllowed: z.boolean().default(true),
  noteReview: z.enum(["ia", "base", "desligada"]).default("ia"),
  reason: z.string().max(300).optional(),
  changedAt: z.string().optional(),
  changedBy: z.string().optional(),
});
export type AiPlatformPolicy = z.infer<typeof AiPlatformSchema>;

export function aiPlatformFrom(raw: unknown): AiPlatformPolicy {
  const parsed = AiPlatformSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : { aiAllowed: true, noteReview: "ia" };
}

/** The office's message when the AI is held back: no word of who did it. */
export const AI_SUSPENDED =
  "O Assistente Virtual está indisponível para esta serventia no momento.";

/** One exigência of a note, as written, without its number. */
export interface NoteItem {
  text: string;
}

const ITEM_START =
  /^\s*(?:(?:\d{1,2}|[IVXL]{1,5})\s*[).:\-\u2013]|[a-z]\)|\(\d{1,2}\)|[-•])\s+/;

/**
 * The exigências of a note: its numbered (or bulleted) items, each joined
 * with the lines that continue it. A note with no numbering is one item.
 */
export function noteItems(text: string): NoteItem[] {
  const items: string[] = [];
  let current: string[] | null = null;
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw
      .replace(/^#+\s*/, "")
      .replace(/\*\*/g, "")
      .trim();
    if (!line) continue;
    if (ITEM_START.test(line)) {
      if (current) items.push(current.join(" "));
      current = [line.replace(ITEM_START, "")];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) items.push(current.join(" "));
  const out = items
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter((t) => t.length >= 15);
  if (out.length) return out.map((t) => ({ text: t }));
  const whole = text.replace(/\s+/g, " ").trim();
  return whole.length >= 15 ? [{ text: whole }] : [];
}

/** Exigência with no norm cited (LRP, art. 198: the note says why). */
export function unfoundedItems(items: readonly NoteItem[]): ReviewFinding[] {
  if (items.length === 0) return [];
  return items
    .filter(
      (item) =>
        normsIn(item.text).length === 0 &&
        !/\bart(?:igo)?s?\.?\s*\d/i.test(item.text),
    )
    .slice(0, 10)
    .map((item) => ({
      kind: "sem-fundamento" as const,
      excerpt: clip(item.text, 240),
      problem:
        "Esta exigência não cita o fundamento legal. A nota devolutiva deve dizer a razão de cada exigência.",
      basis: "Lei nº 6.015/1973, art. 198",
      suggestion:
        "Acrescente a norma e o artigo que fundamentam a exigência, ou retire-a se não houver base legal.",
      source: "base" as const,
    }));
}

/** "art. 213" and the norm next to it, in one exigência. */
export interface ArticleCitation {
  article: string;
  norm: ReturnType<typeof normsIn>[number];
  excerpt: string;
}

/** Each article cited with the norm it belongs to, item by item. */
export function articleCitations(
  items: readonly NoteItem[],
): ArticleCitation[] {
  const out: ArticleCitation[] = [];
  for (const item of items) {
    const norms = normsIn(item.text);
    if (norms.length === 0) continue;
    const norm = norms[0];
    if (!norm) continue;
    for (const m of item.text.matchAll(
      /\bart(?:igo)?s?\.?\s*(\d{1,4}(?:-[A-Z]{1,2})?)/gi,
    )) {
      const article = m[1] ?? "";
      if (!out.some((o) => o.article === article && o.norm === norm)) {
        out.push({ article, norm, excerpt: clip(item.text, 240) });
      }
    }
  }
  return out.slice(0, 30);
}

const clip = (text: string, max: number) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
};

const fold = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Words of the trade that are written with a capital and are no one's
 * name: a run of capitalized words made only of others is taken as a name.
 */
const TRADE_WORDS = new Set(
  `lei leis decreto decreto-lei provimento provimentos resolucao codigo civil nacional normas norma registro registros imoveis imovel publicos publico cartorio cartorios serventia oficial oficio tabelionato tabeliao notas protesto titulos titulo documentos documento pessoas naturais juridicas corregedoria geral justica conselho tribunal superior federal estadual estado ministerio receita prefeitura municipio municipal uniao republica constituicao cnj cgj rn stj stf csm sp incra sigef ccir itr itbi itcd itcmd car art cpf cnpj rg cnh nota devolutiva exigencia exigencias certidao certidoes escritura matricula livro folha protocolo requerente apresentante partes parte confrontante confrontantes memorial descritivo planta anotacao responsabilidade tecnica crea cau sistema cadastro ambiental rural secretaria fazenda tesouro junta comercial ordem advogados oab defensoria juiz juizo vara comarca unico anexo paragrafo inciso alinea capitulo secao lrp cnn cn declaracao requerimento procuracao guia comprovante imposto contrato averbacao retificacao georreferenciamento area termo alvara laudo recibo quitacao negativa positiva debitos onus reais inteiro teor atualizada atualizado pacto antenupcial casamento nascimento obito uniao estavel inventario partilha formal divorcio separacao sentenca mandado judicial extrajudicial dou diario uniao brasil brasileiro brasileira codigo-civil lgpd anpd sefaz semace iphan spu incra-sncr sncr nirf cib cafir siafi cep cns iptu`.split(
    /\s+/,
  ),
);
const CONNECTORS = new Set(["de", "da", "do", "dos", "das", "e"]);

/**
 * Proper names out: a run of two or more capitalized words (the first word
 * of a sentence does not count) with none of the trade's words becomes
 * "[NOME]", and the item carrying it is then not learned.
 */
export function maskNames(text: string): string {
  const tokens = text.split(/(\s+)/);
  const out: string[] = [];
  let run: string[] = [];
  const flush = () => {
    let last = -1;
    run.forEach((t, k) => {
      if (/^[A-ZÀ-Ý]/.test(t)) last = k;
    });
    const name = run.slice(0, last + 1);
    const tail = run.slice(last + 1);
    const capitals = name.filter((t) => /^[A-ZÀ-Ý]/.test(t));
    const trade = capitals.some((t) =>
      TRADE_WORDS.has(fold(t.replace(/[.,;:()"“”']/g, ""))),
    );
    if (capitals.length >= 2 && !trade) out.push("[NOME]");
    else out.push(...name);
    out.push(...tail);
    run = [];
  };
  for (const token of tokens) {
    const bare = token.replace(/[.,;:()"“”']/g, "");
    const capitalized = /^[A-ZÀ-Ý][a-zà-ÿ]+$/.test(bare);
    const connector =
      run.length > 0 &&
      (/^\s+$/.test(token) || CONNECTORS.has(bare.toLowerCase()));
    // A word glued to punctuation ends the run after it: "Silva," is
    // still the name, the comma closes it.
    if (capitalized || connector) {
      run.push(token);
      if (capitalized && /[.,;:)]$/.test(token)) flush();
    } else {
      if (run.length) flush();
      out.push(token);
    }
  }
  if (run.length) flush();
  return out.join("");
}

/**
 * The first sentence of a text: up to the first full stop that does not
 * close an abbreviation of the trade ("art.", "nº.", "inc.").
 */
function firstSentence(text: string): string {
  const end =
    /(?<!\b(?:[Aa]rts?|[Nn][ºo°]?|[Ii]nc|[Aa]l|[Pp]ar|[Cc]f|[Ss]r|[Ss]ra))[.;](?=\s|$)/.exec(
      text,
    );
  return (end ? text.slice(0, end.index) : text).trim();
}

/** The norm cited in an exigência, as written: what it is founded on. */
function basisOf(text: string): string {
  const parenthetical = [...text.matchAll(/\(([^()]{5,200})\)/g)]
    .map((m) => m[1] ?? "")
    .find((inside) => normsIn(inside).length > 0);
  if (parenthetical) return parenthetical.trim();
  const at = text.search(
    /\b(?:arts?\.?\s*\d|lei|decreto|provimento|resolu[cç][aã]o|c[oó]digo)/i,
  );
  if (at < 0) return "";
  return clip(firstSentence(text.slice(at)), 300);
}

/** The first sentence, short and without its citation: the title. */
function titleOf(text: string): string {
  const plain = text.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ");
  const first = firstSentence(plain)
    .replace(
      /,?\s*(?:conforme|nos termos d[oa]|de acordo com|segundo)\b.*$/i,
      "",
    )
    .trim();
  return clip(first, 90).replace(/…$/, "");
}

/**
 * What is learned from a note with no AI and no credit: each exigência that
 * cites its fundamento, as written, with names and personal data out. An
 * exigência that still carries a name or a number of someone is dropped,
 * never stored (LGPD).
 */
export function learnWithoutAi(text: string): LearnedRequirement[] {
  const candidates: LearnedRequirement[] = [];
  for (const item of noteItems(text)) {
    const clean = maskNames(item.text);
    const basis = basisOf(clean);
    if (!basis || normsIn(basis).length === 0) continue;
    candidates.push({
      title: titleOf(clean),
      description: clean,
      howToComply: clean,
      basis,
    });
  }
  return cleanLearned(candidates);
}

/** The summary of a review made by the base alone. */
export function baseSummary(
  findings: readonly ReviewFinding[],
  missing: readonly string[],
): string {
  const parts = [
    findings.length
      ? "Conferida pela base jurídica da serventia, sem IA."
      : "Conferida pela base jurídica da serventia, sem IA: nada a apontar.",
  ];
  if (missing.length) {
    parts.push(
      `A base ainda não tem ${missing.slice(0, 4).join(", ")}${missing.length > 4 ? " e outras" : ""}: importe em Base jurídica para conferir também essas normas.`,
    );
  }
  return parts.join(" ");
}
