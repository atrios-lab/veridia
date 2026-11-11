import type { EmailText } from "../email/text.ts";
import { brDate, monthLabel, type Quarter, quarterLabel } from "./stock.ts";

/**
 * The office's reminder by e-mail (decision of 11/11/2026): once the
 * quarter is over, to render the accounts of art. 60, § 1º; and, when a
 * sheet was lost, stolen or damaged in a month already over, to send the
 * ofício of art. 59. Each goes once; the panel keeps the warning until the
 * paper is issued.
 */
export function buildSecurityPaperReminderEmail(input: {
  officeName: string;
  quarter: Quarter | null;
  occurrences: { occurredOn: string }[];
  deadlineDay: number | null;
  /** Kinds down to the warning line (decision of 11/11/2026: 200 sheets). */
  low?: { kind: string; remaining: number }[];
  /** "outubro de 2026": a month with sheets and no use registered. */
  usageMonth?: string;
}): EmailText {
  const lines: string[] = [];
  if (input.usageMonth) {
    lines.push(
      `Ainda não há uso de papel de segurança lançado em ${input.usageMonth}. Em "Lançar uso ou ocorrência", escolha "Usei até a folha nº", informe a última folha usada no mês e a data do último dia do mês. Se não houve uso, não é preciso fazer nada.`,
    );
  }
  for (const l of input.low ?? []) {
    lines.push(
      l.remaining === 0
        ? `${l.kind}: o estoque de papel de segurança acabou. Providencie o pedido de um novo lote.`
        : `${l.kind}: faltam ${l.remaining.toLocaleString("pt-BR")} folhas para acabar o estoque. Providencie o pedido de um novo lote (Utilitários › Solicitação de papéis de segurança).`,
    );
  }
  if (input.quarter) {
    const q = input.quarter;
    const due = input.deadlineDay
      ? ` O prazo configurado é o dia ${input.deadlineDay} do mês seguinte ao trimestre.`
      : "";
    lines.push(
      `A prestação de contas do papel de segurança do ${quarterLabel(q)} ainda não foi gerada. O Código de Normas pede a prestação trimestral à Corregedoria, com o estoque inicial, as folhas utilizadas, extraviadas, avariadas ou inutilizadas e o que resta.${due}`,
      "Quem não presta contas no prazo fica impedido de requisitar novos lotes.",
    );
  }
  if (input.occurrences.length) {
    const months = [
      ...new Set(input.occurrences.map((o) => monthLabel(o.occurredOn))),
    ];
    const first = input.occurrences
      .map((o) => o.occurredOn)
      .sort()[0] as string;
    lines.push(
      `Há ${input.occurrences.length === 1 ? "1 extravio, subtração ou avaria" : `${input.occurrences.length} extravios, subtrações ou avarias`} de papel de segurança ainda não comunicado${input.occurrences.length === 1 ? "" : "s"} à Corregedoria (${months.join(", ")}; o primeiro em ${brDate(first)}). A comunicação é feita no fim de cada mês, com a numeração das folhas.`,
    );
  }
  if (input.quarter || input.occurrences.length) {
    lines.push(
      "O ofício sai pronto no painel, com a planilha das folhas: é só conferir, assinar (digitalmente ou à mão) e enviar.",
    );
  }
  const subject = input.quarter
    ? `Papel de segurança: prestação de contas do ${quarterLabel(input.quarter, false)}`
    : input.occurrences.length
      ? "Papel de segurança: comunicar extravio à Corregedoria"
      : input.low?.length
        ? "Papel de segurança: estoque baixo, pedir novo lote"
        : `Papel de segurança: lance o uso de ${input.usageMonth ?? "o mês"}`;
  return {
    subject,
    paragraphs: lines,
    buttonLabel: "Abrir o papel de segurança",
    footnote: `${input.officeName} · Lembrete automático do controle do papel de segurança.`,
  };
}
