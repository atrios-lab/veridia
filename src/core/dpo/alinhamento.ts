import type { DataRight } from "../request/kinds.ts";
import { PLACEHOLDERS } from "./placeholders.ts";

/**
 * The conversation on an LGPD requerimento (decision of 15/11/2026): the
 * Assistente Virtual looks up what the law says about the pedido, tells
 * the team what the office may keep and why, what it must give, correct
 * or delete, and asks what it needs to know. The team and the Assistente
 * Virtual align the answer; the final decision is the encarregado's or the
 * Tabelião's (`lgpd.decide`), never the model's.
 */

/** What the conversation has to clear up, by the right asked. */
export const ALIGNMENT_TOPICS: Record<DataRight, readonly string[]> = {
  access: [
    "em que livros, arquivos ou sistemas da serventia os dados aparecem (tipo de ato, sem o dado em si)",
    "se há dado de ato sujeito à publicidade registral ou notarial, que se obtém por certidão",
    "se a resposta será a declaração simplificada ou a completa, e o prazo de cada uma",
  ],
  rectification: [
    "qual dado está incorreto (o tipo do dado, não o dado em si)",
    "se o dado está só em cadastro interno, que se corrige direto, ou em registro ou ato, que depende de retificação pelo procedimento próprio",
  ],
  deletion: [
    "quais dados estão em livros, índices e arquivos que a serventia tem dever legal de conservar",
    "quais dados estão só em cadastros auxiliares (site, contato, agenda) e podem ser eliminados",
    "se algum prazo de guarda ou tabela de temporalidade ainda corre",
  ],
  other: [
    "o que exatamente o titular pede (informação sobre compartilhamento, portabilidade, revogação de consentimento ou outro)",
    "com quem a serventia compartilha dados por dever legal (centrais, Corregedoria, órgãos públicos)",
  ],
};

const RIGHT_NAMES: Record<DataRight, string> = {
  access: "acesso aos dados (confirmação de tratamento e acesso)",
  rectification: "correção de dados incompletos, inexatos ou desatualizados",
  deletion: "eliminação (exclusão) de dados",
  other:
    "outro direito do titular (portabilidade, informação sobre compartilhamento, revogação do consentimento, entre outros)",
};

export function alignmentInstructions(
  officeContext: string,
  right: DataRight,
): string {
  return `Você é o Assistente Virtual do encarregado de dados (DPO) de um cartório (serventia extrajudicial) do Rio Grande do Norte. Você conversa com alguém da equipe sobre um requerimento de titular de dados recebido pelo canal LGPD, para alinharem juntos a resposta. O titular pediu: ${RIGHT_NAMES[right]}.

Como conduzir:
1. Pesquise nos trechos da BASE o que a lei e as normas dizem sobre este pedido e explique à equipe, em linguagem simples: o que a serventia pode (ou deve) conservar e por qual motivo, o que precisa entregar, corrigir ou eliminar, e em que prazo. Exemplo do tipo de orientação esperada: "os dados que estão no livro de registro ficam, porque a serventia tem o dever legal de conservá-los; o contato do cadastro do site pode ser eliminado".
2. Logo depois de cada afirmação sobre regra, prazo, obrigação ou direito, cite a fonte no formato [[fonte:ID]], usando exatamente o ID do trecho. Nunca cite um ID que não esteja na lista. Nunca invente artigo, prazo ou norma. Se a BASE não cobre um ponto, diga que não encontrou fundamento e que o ponto fica para o encarregado decidir.
3. Pergunte à equipe o que você precisa saber para orientar bem, no máximo duas perguntas por vez. Pontos a esclarecer ao longo da conversa: ${ALIGNMENT_TOPICS[right].join("; ")}.
4. Quando a equipe responder, ajuste a orientação ao caso. A resposta ao titular vai sair completa, sem nada para a equipe completar: por isso, pergunte tudo o que for necessário antes. Quando já houver o suficiente, resuma em tópicos o que foi alinhado (o que se atende, o que se nega e por quê) e diga que a equipe pode pedir a preparação da resposta.
5. Você orienta; a decisão final é do encarregado de dados ou do Tabelião. Diga isso quando a orientação envolver negar, no todo ou em parte, o que o titular pediu.
6. Nunca peça nem repita nome, CPF, documento, endereço, telefone, e-mail ou outro dado de pessoa. Se a mensagem trouxer um marcador como [CPF] ou [E-MAIL], é um dado que a plataforma ocultou: siga com a situação em abstrato. Para se referir ao titular, use [TITULAR].
7. Fale só deste requerimento e de proteção de dados. Se a conversa sair desse tema, diga em uma frase que só pode ajudar com este requerimento.
8. Não mencione nomes de empresas, fornecedores ou da equipe por trás da plataforma.
9. Formato: parágrafos curtos e listas com "-". Sem títulos com "#", sem tabelas. Não escreva a carta ao titular nesta conversa: ela é preparada depois, com os marcadores ${PLACEHOLDERS.map((p) => `[${p}]`).join(", ")}.

DADOS DA SERVENTIA
${officeContext}`;
}

/** The first turn, when the team opens the conversation. */
export const ALIGNMENT_START =
  "Analise este requerimento: diga o que a lei e as normas dizem sobre o pedido e o que você precisa saber da serventia.";

/** The search terms of each turn: the right asked, plus what was said. */
export const ALIGNMENT_QUERIES: Record<DataRight, string> = {
  access:
    "direito acesso titular confirmação existência tratamento prazo declaração simplificada completa certidão publicidade",
  rectification:
    "correção dados inexatos desatualizados titular retificação registro procedimento",
  deletion:
    "eliminação dados titular conservação obrigação legal guarda livros arquivos permanentes",
  other:
    "direitos titular portabilidade informação compartilhamento revogação consentimento centrais",
};

export interface AlignmentMessage {
  role: "user" | "assistant" | "refusal";
  content: string;
}

/**
 * What was aligned, for the draft: the conversation as it was stored
 * (already masked), newest kept when it is too long.
 */
export function alignmentTranscript(
  messages: readonly AlignmentMessage[],
  max = 3800,
): string {
  const lines = messages
    .filter((m) => m.role !== "refusal" && m.content !== ALIGNMENT_START)
    .map(
      (m) =>
        `${m.role === "user" ? "Equipe" : "Assistente Virtual"}: ${m.content.replace(/\s*\[\[fonte:[a-z0-9-]+\]\]/g, "")}`,
    );
  const kept: string[] = [];
  let size = 0;
  for (const line of [...lines].reverse()) {
    if (size + line.length > max) break;
    kept.unshift(line);
    size += line.length + 1;
  }
  return kept.length
    ? `O que foi alinhado com a equipe:\n${kept.join("\n")}`
    : "";
}

export interface ReplyApproval {
  /** The exact text approved. */
  text: string;
  byId: string;
  byName: string;
  byRole: string;
  at: string;
}

/**
 * Where the answer stands against the final decision: nothing approved,
 * approved as it is, or changed after the approval (it needs a new one).
 */
export function approvalStatus(
  approval: ReplyApproval | undefined,
  reply: string,
): "pending" | "approved" | "changed" {
  if (!approval) return "pending";
  return approval.text.trim() === reply.trim() ? "approved" : "changed";
}

/**
 * Whether this answer may go to the titular: whoever holds the decision
 * sends it on their own authority; anyone else only the text approved.
 */
export function mayAnswer(
  canDecide: boolean,
  approval: ReplyApproval | undefined,
  reply: string,
): boolean {
  return canDecide || approvalStatus(approval, reply) === "approved";
}

export const APPROVAL_NEEDED =
  "A resposta precisa da aprovação do encarregado de dados ou do Tabelião antes de ir ao titular. Salve o rascunho e peça a aprovação.";
