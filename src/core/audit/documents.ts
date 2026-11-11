import { formatGuideNumber } from "../guides/schema.ts";
import type { RequerimentoDocument } from "../request/requerimento.ts";
import { writtenDate } from "../scheduling/attendance.ts";
import { toIsoDate } from "../scheduling/calendar.ts";
import { officialName } from "../tenant/identification.ts";
import type { Tenant } from "../tenant/schema.ts";
import { formatOfficeDateTime, OFFICE_TIME_ZONE } from "../time/office-time.ts";
import { ANSWER_HOURS, auditActionLabel } from "./labels.ts";

export interface EntryForDocument {
  createdAt: Date;
  action: string;
  targetType: string;
  targetId: string | null;
  /** The target in words, when the trail could name it (a person). */
  targetLabel?: string | null;
  actorName: string | null;
}

/** Text typed in a form: the browser sends CRLF; each line is a paragraph. */
export function paragraphsOf(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

const entryRow = (entry: EntryForDocument) => {
  const target = entry.targetLabel ?? entry.targetId;
  return {
    label: formatOfficeDateTime(entry.createdAt),
    value: [
      auditActionLabel(entry.action),
      // The person's own account (their sign-in) is said once, not twice.
      target && target !== entry.actorName ? `(${target})` : "",
      entry.actorName ? `· ${entry.actorName}` : "",
    ]
      .filter(Boolean)
      .join(" "),
  };
};

/**
 * The formal notification asking a person of the office to explain acts of
 * the audit trail: the facts, the legal basis, the 24 hours to answer and
 * where. Drawn with the office's letterhead by `renderDocument`; signed by
 * hand after printing, or digitally in the assinador.
 */
export function buildNotificationDocument(
  tenant: Tenant,
  input: {
    year: number;
    sequence: number;
    subject: string;
    facts: string;
    legalBasis: string;
    targetName: string;
    targetRoleLabel: string;
    deadlineAt: Date;
    issuedAt: Date;
    entries: EntryForDocument[];
    holderName: string;
    holderTitle: string;
  },
): RequerimentoDocument {
  const number = formatGuideNumber(input.year, input.sequence);
  return {
    eyebrow: "Auditoria interna",
    title: `Notificação nº ${number}`,
    subtitle: input.subject,
    office: [officialName(tenant), tenant.subtitle],
    sections: [
      {
        heading: "Notificado(a)",
        rows: [
          { label: "Nome", value: input.targetName },
          { label: "Cargo", value: input.targetRoleLabel },
          {
            label: "Prazo para resposta",
            value: `${formatOfficeDateTime(input.deadlineAt)} (${ANSWER_HOURS} horas)`,
          },
        ],
      },
      { heading: "Dos fatos", paragraphs: paragraphsOf(input.facts) },
      ...(input.entries.length
        ? [
            {
              heading: "Atos registrados no painel",
              rows: input.entries.map(entryRow),
            },
          ]
        : []),
      {
        heading: "Da fundamentação",
        paragraphs: paragraphsOf(input.legalBasis),
      },
      {
        heading: "Do pedido de esclarecimentos",
        paragraphs: [
          `Fica Vossa Senhoria NOTIFICADO(A) a apresentar, no prazo de ${ANSWER_HOURS} (vinte e quatro) horas contadas do recebimento desta, os esclarecimentos que entender cabíveis sobre os fatos acima, por escrito, na área Auditoria do painel da serventia, podendo juntar documentos.`,
          "A ausência de manifestação no prazo será registrada, sem prejuízo das providências que couberem ao titular no exercício do gerenciamento administrativo da serventia.",
        ],
      },
    ],
    dateLine: `${tenant.location.city}/${tenant.location.state}, ${writtenDate(toIsoDate(input.issuedAt, OFFICE_TIME_ZONE))}.`,
    signee: input.holderName,
    signature: [input.holderTitle],
    footer: `${officialName(tenant)} · Notificação nº ${number} · Auditoria interna · ${tenant.legalFooter}`,
  };
}

/** The selected entries of the trail, as a report. */
export function buildAuditReportDocument(
  tenant: Tenant,
  input: { entries: EntryForDocument[]; issuedAt: Date; scope: string },
): RequerimentoDocument {
  return {
    eyebrow: "Auditoria interna",
    title: "Relatório de auditoria",
    subtitle: `${input.scope} · gerado em ${formatOfficeDateTime(input.issuedAt)}`,
    office: [officialName(tenant), tenant.subtitle],
    sections: [
      {
        heading: `Registros (${input.entries.length})`,
        rows: input.entries.map(entryRow),
      },
      {
        heading: "Observação",
        paragraphs: [
          "Registros do painel da serventia, mantidos para responder quem fez o quê e quando (Lei nº 13.709/2018, art. 37). Uso interno.",
        ],
      },
    ],
    signature: [],
    footer: `${officialName(tenant)} · Relatório de auditoria · ${tenant.legalFooter}`,
  };
}
