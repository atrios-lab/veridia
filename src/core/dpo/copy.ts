import { type MaskCounts, type MaskKind, maskedTotal } from "./mask.ts";

/**
 * Every sentence the DPO assistant's screens show, in one place. None of
 * them names the company behind the platform (decision of 15/11/2026: the
 * offices never see that name); "equipe da plataforma" is how it is said.
 */
export const DPO_COPY = {
  refusal:
    "Eu só posso ajudar com proteção de dados pessoais: LGPD, Provimento 213/2026, papel do encarregado (DPO), direitos do titular, respostas ao titular e à ANPD, incidentes e adequação da serventia. Reformule a pergunta dentro desse tema.",
  dataNotice:
    'Não informe nomes, CPF, endereços ou outros dados de pessoas. Descreva a situação, por exemplo: "um titular pediu a exclusão dos seus dados". Se algum dado for enviado, ele será ocultado automaticamente antes de chegar à inteligência artificial.',
  oversightNotice:
    "As conversas ficam guardadas por 12 meses e podem ser lidas pela equipe de suporte da plataforma, para suporte e melhoria do assistente.",
  notAdvice:
    "O assistente orienta com base nas normas citadas. A decisão e a assinatura continuam sendo do encarregado.",
  noSource: "Resposta sem fonte na base de normas: confirme antes de usar.",
  unavailable: "O assistente do DPO está indisponível neste ambiente.",
  rateLimited: "Muitas perguntas seguidas. Aguarde um minuto e tente de novo.",
  failed:
    "Não foi possível obter a resposta agora. Tente de novo em instantes.",
  draftReviewed:
    "Rascunho gerado pelo assistente do DPO. Revise e complete antes de enviar.",
  quotaReached: (resumesOn: string) =>
    `O limite de perguntas deste mês foi atingido pela serventia. O assistente volta em ${resumesOn}.`,
} as const;

const KIND_LABELS: Record<MaskKind, [string, string]> = {
  email: ["e-mail", "e-mails"],
  registry: ["matrícula", "matrículas"],
  cnpj: ["CNPJ", "CNPJs"],
  cpf: ["CPF", "CPFs"],
  cns: ["cartão do SUS", "cartões do SUS"],
  keyed: ["documento", "documentos"],
  phone: ["telefone", "telefones"],
  cep: ["CEP", "CEPs"],
  address: ["endereço", "endereços"],
  birth: ["data de nascimento", "datas de nascimento"],
  number: ["número", "números"],
};

/** "Ocultamos 1 CPF e 2 e-mails desta mensagem." Empty when nothing was. */
export function describeMasked(counts: MaskCounts): string {
  if (maskedTotal(counts) === 0) return "";
  const parts = (Object.keys(KIND_LABELS) as MaskKind[])
    .filter((kind) => (counts[kind] ?? 0) > 0)
    .map((kind) => {
      const n = counts[kind] ?? 0;
      return `${n} ${KIND_LABELS[kind][n === 1 ? 0 : 1]}`;
    });
  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} e ${parts.at(-1)}`;
  return `Ocultamos ${list} desta mensagem.`;
}
