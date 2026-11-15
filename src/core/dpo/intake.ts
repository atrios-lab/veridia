import type { DataRight } from "../request/kinds.ts";

/**
 * What the Assistente Virtual asks the office before drafting the answer
 * to an LGPD requerimento (decision of 15/11/2026: "antes de preparar as
 * respostas, ele deve perguntar algumas coisas ao cartório, para então
 * saber melhor responder"). Fixed questions by the right asked, answered
 * by choice and a short note; the answers go to the draft without any
 * personal data (core/dpo/mask is applied to the notes).
 */
export interface IntakeQuestion {
  id: string;
  text: string;
  options: string[];
  /** A note under the choice, when the answer needs one. */
  noteLabel?: string;
}

const YES_NO = ["Sim", "Não", "Em parte", "Ainda não verificado"];

const COMMON: IntakeQuestion[] = [
  {
    id: "identidade",
    text: "A identidade do titular foi confirmada (o documento enviado confere com o pedido)?",
    options: ["Sim", "Não", "Pendente"],
    noteLabel: "Se não ou pendente, o que falta",
  },
  {
    id: "dados",
    text: "Os dados pessoais do titular constam nos livros, arquivos ou sistemas da serventia?",
    options: YES_NO,
    noteLabel:
      "Onde constam (tipo de ato, livro ou sistema, sem dados pessoais)",
  },
  {
    id: "publicidade",
    text: "Os dados estão em atos sujeitos à publicidade registral ou notarial (obtidos por certidão)?",
    options: ["Sim", "Não", "Não se aplica"],
  },
];

const BY_RIGHT: Record<DataRight, IntakeQuestion[]> = {
  access: [
    {
      id: "formato",
      text: "Como a serventia vai atender o acesso?",
      options: [
        "Declaração simplificada",
        "Declaração completa",
        "Por certidão do ato",
        "Não há dados a fornecer",
      ],
      noteLabel: "Observação sobre o atendimento",
    },
  ],
  rectification: [
    {
      id: "via",
      text: "A correção pode ser feita diretamente ou depende de procedimento próprio?",
      options: [
        "Pode ser corrigida no cadastro interno",
        "Depende de retificação do registro ou do ato",
        "Depende de ordem judicial",
        "Ainda não verificado",
      ],
      noteLabel: "Qual dado está incorreto (sem o dado em si)",
    },
  ],
  deletion: [
    {
      id: "guarda",
      text: "Há obrigação legal de guardar os dados (livros e arquivos permanentes, prazos de guarda)?",
      options: YES_NO,
      noteLabel: "Quais dados podem ser eliminados, se algum",
    },
  ],
  other: [
    {
      id: "pedido",
      text: "O que exatamente o titular pede e o que a serventia pode fazer?",
      options: [
        "Informação sobre compartilhamento",
        "Portabilidade",
        "Revogação de consentimento",
        "Outro",
      ],
      noteLabel: "Descreva o pedido (sem dados pessoais)",
    },
  ],
};

export const intakeQuestions = (right: DataRight): IntakeQuestion[] => [
  ...COMMON,
  ...BY_RIGHT[right],
];

export interface IntakeAnswers {
  /** question id → { choice, note } */
  answers: Record<string, { choice: string; note: string }>;
  /** Anything else the office wants the Assistente Virtual to know. */
  notes: string;
}

/** What is still missing: every question needs a choice. */
export function intakeProblems(
  right: DataRight,
  intake: IntakeAnswers,
): string[] {
  return intakeQuestions(right)
    .filter((q) => !q.options.includes(intake.answers[q.id]?.choice ?? ""))
    .map((q) => `Responda: ${q.text}`);
}

/** The answers as the note the draft reads (already masked by the caller). */
export function intakeNote(right: DataRight, intake: IntakeAnswers): string {
  const lines = intakeQuestions(right).map((q) => {
    const a = intake.answers[q.id];
    const note = a?.note.trim();
    return `- ${q.text} ${a?.choice ?? "Sem resposta"}${note ? ` (${note})` : ""}`;
  });
  return [
    "Respostas da serventia:",
    ...lines,
    ...(intake.notes.trim() ? [`Observações: ${intake.notes.trim()}`] : []),
  ].join("\n");
}
