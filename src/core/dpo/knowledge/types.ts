/**
 * One provision of the DPO assistant's knowledge base: an article of a law
 * or of a normative act, as published, or one of the platform's own notes.
 *
 * The base is versioned in the repository on purpose (design of the change
 * `assistente-do-dpo`, decision 3): updating it is a pull request someone
 * reviews, and the assistant can only cite what is here.
 */
export interface KnowledgeProvision {
  /**
   * Stable id the model cites as `[[fonte:<id>]]`, lower case, ascii, words
   * joined by dashes: `lgpd-art-18`, `prov213-art-16`, `orientacao-prazo-15-dias`.
   * Never reuse an id for a different text: old conversations point to it.
   */
  id: string;
  /** Which act it comes from (see SOURCES in ./index.ts). */
  source: KnowledgeSourceId;
  /** How a person cites it: "LGPD, art. 18". */
  citation: string;
  /**
   * The full text of the article as in force, including its paragraphs and
   * incisos. Revoked parts are left out. No em or en dashes (the repository
   * forbids them in src): the inciso separator is a plain hyphen.
   */
  text: string;
}

export type KnowledgeSourceId =
  | "lgpd"
  | "prov213"
  | "cnn"
  | "anpd"
  | "cgj-rn"
  | "orientacao";

export interface KnowledgeSource {
  id: KnowledgeSourceId;
  /** Full name shown next to a citation: "Lei nº 13.709/2018 (LGPD)". */
  name: string;
  /** Official page the text was taken from; empty for the platform's notes. */
  url: string;
  /**
   * Whether it is a norm or the platform's guidance: the screen says which.
   * The guidance never names the company behind the platform (decision of
   * 15/11/2026: the offices never see that name).
   */
  kind: "norm" | "guidance";
}
