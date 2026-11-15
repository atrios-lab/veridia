import type { Permission } from "../auth/roles.ts";
import type { SourceArea } from "../conhecimento/base.ts";

/**
 * "Tirar dúvida" (decision of 15/11/2026: "nas plataformas onde for
 * necessário, tenha um campo para que o funcionário tire a dúvida"): a
 * question about the screen's own subject, answered by the Assistente
 * Virtual from the office's legal base and the official sources. Off the
 * subject it declines; it never becomes a free chat.
 */
export interface QuestionTopic {
  /** "Dúvida sobre ..." on the screen. */
  label: string;
  /** What the Assistente Virtual may answer about. */
  scope: string;
  /** Who may ask: the screen's own permission. */
  permission: Permission;
  /** The legal base's attribution to search first, when there is one. */
  area?: SourceArea;
}

export const QUESTION_TOPICS = {
  qualificacao: {
    label: "qualificação de títulos",
    scope:
      "qualificação registral e notarial de títulos em todas as atribuições: exigências, nota devolutiva, reexame, qualificação positiva, prazos, suscitação de dúvida, Lei nº 6.015/1973, Lei nº 8.935/1994, Código Civil, Código Nacional de Normas e normas da Corregedoria",
    permission: "qualificacao.manage",
  },
  "base-juridica": {
    label: "a base jurídica",
    scope:
      "fontes do direito aplicáveis aos registros públicos, às notas e ao protesto: leis, decretos, provimentos, resoluções, jurisprudência e doutrina; vigência e hierarquia das normas",
    permission: "knowledge.manage",
  },
  censec: {
    label: "as cargas da CENSEC",
    scope:
      "cargas da CENSEC (CEP, CESDI, RCTO e CTP): o que informar, prazos, fechamento e informação negativa, conforme o Código Nacional de Normas",
    permission: "censec.manage",
    area: "notas",
  },
  doi: {
    label: "a DOI",
    scope:
      "Declaração sobre Operações Imobiliárias (DOI) à Receita Federal: quando entregar, campos, prazos e retificação, conforme as instruções normativas da Receita",
    permission: "doi.manage",
    area: "ri",
  },
  titularidade: {
    label: "a comunicação de titularidade",
    scope:
      "comunicação de mudança de titularidade de imóveis ao município (Código Nacional de Normas, art. 184-A): quais atos, prazos e conteúdo",
    permission: "titularidade.manage",
  },
  "registro-civil": {
    label: "o Registro Civil",
    scope:
      "registro civil das pessoas naturais: nascimento, casamento, óbito, habilitação, averbações, retificações, alteração de nome e certidões, conforme a Lei nº 6.015/1973 e o Código Nacional de Normas",
    permission: "rcpn.search",
    area: "rcpn",
  },
} as const satisfies Record<string, QuestionTopic>;

export type QuestionTopicKey = keyof typeof QUESTION_TOPICS;
export const isQuestionTopic = (value: string): value is QuestionTopicKey =>
  Object.hasOwn(QUESTION_TOPICS, value);

export const QUESTION_MAX = 1500;
