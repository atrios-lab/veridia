import { ATTRIBUTION_NAMES } from "../acts/catalog.ts";
import type { Classification } from "../compliance/classification.ts";
import { formatDate, type IsoDate } from "../scheduling/calendar.ts";
import type { Attribution } from "../tenant/schema.ts";

/**
 * What the assistant knows about the office it is talking to. Only figures
 * and categories that identify no one: the input type has no field where a
 * name, document or contact could go, and that is the guarantee, not a
 * filter applied afterwards. Not even the DPO's name: "is there one" is all
 * the assistant needs.
 */
export interface OfficeFacts {
  attributions: readonly Attribution[];
  classification: Classification | null;
  pendencies: { critical: number; warning: number; info: number };
  openDataRights: number;
  /** Open LGPD requerimentos with five days or less left, overdue included. */
  dataRightsDueSoon: number;
  hasDpo: boolean;
  today: IsoDate;
}

export function describeOffice(facts: OfficeFacts): string {
  const lines: string[] = [`Data de hoje: ${formatDate(facts.today)}.`];
  lines.push(
    `Atribuições da serventia: ${
      facts.attributions.map((a) => ATTRIBUTION_NAMES[a]).join("; ") ||
      "não informadas"
    }.`,
  );
  const c = facts.classification;
  if (c) {
    lines.push(
      `Enquadramento no Provimento 213/2026 (art. 16, redação do 243/2026): Classe ${c.classe}, subclasse ${c.subclasse}.`,
      `Prazo da Etapa 1: ${c.stage1Days} dias, até ${formatDate(c.stage1Deadline)}. Conclusão do programa: ${c.completionMonths} meses, até ${formatDate(c.completionDeadline)}.`,
    );
  } else {
    lines.push(
      "Classe no Provimento 213/2026: desconhecida. A serventia ainda não informou a receita bruta do semestre na tela Adequação ao Provimento. Não presuma uma classe.",
    );
  }
  const p = facts.pendencies;
  lines.push(
    `Pendências apontadas na Adequação ao Provimento: ${p.critical} críticas, ${p.warning} de atenção, ${p.info} informativas.`,
    `Requerimentos LGPD em aberto: ${facts.openDataRights}, dos quais ${facts.dataRightsDueSoon} vencem em até 5 dias ou já venceram.`,
    facts.hasDpo
      ? "A serventia tem encarregado (DPO) cadastrado no painel."
      : "A serventia ainda não cadastrou o encarregado (DPO) no painel.",
  );
  return lines.join("\n");
}
