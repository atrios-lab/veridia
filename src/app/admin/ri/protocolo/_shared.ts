import "server-only";
import { brDate } from "@/core/ri/property.ts";
import {
  PROTOCOL_STATUS_LABELS,
  type ProtocolStatus,
  urgencyOf,
} from "@/core/ri/protocol.ts";
import { addDays } from "@/core/scheduling/calendar.ts";
import type { ProtocolRow } from "@/lib/ri-protocols.ts";
import type { ProtocolFormValue } from "../_components/protocol-form.tsx";

/** The situação as the office says it (exame has its own words). */
export function statusText(row: Pick<ProtocolRow, "kind" | "status">): string {
  if (row.kind === "exame" && row.status === "prenotado") {
    return "Em exame e cálculo";
  }
  return PROTOCOL_STATUS_LABELS[row.status as ProtocolStatus] ?? row.status;
}

const TONES = {
  vencido: "bg-destructive/10 text-destructive",
  hoje: "bg-warning-soft text-warning-text",
  amanha: "bg-warning-soft text-warning-text",
  "no-prazo": "bg-muted text-muted-foreground",
} as const;

const WORDS = {
  vencido: "vencido",
  hoje: "vence hoje",
  amanha: "vence amanhã",
  "no-prazo": "no prazo",
} as const;

/** "16/03/2026 · vence hoje", with its colour. */
export function dueOf(due: string | null, today: string) {
  if (!due) return null;
  const urgency = urgencyOf(due, today, addDays(today, 1));
  return {
    text: `${brDate(due)} · ${WORDS[urgency]}`,
    tone: TONES[urgency],
  };
}

const money = (cents: number | null) =>
  cents === null
    ? ""
    : (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

export function formValueOf(
  row: ProtocolRow,
  matriculas: string,
): ProtocolFormValue {
  return {
    id: row.id,
    kind: row.kind === "exame" ? "exame" : "prenotacao",
    presentedOn: brDate(row.presentedOn),
    presenterName: row.presenterName,
    presenterDocument: row.presenterDocument,
    presenterContact: row.presenterContact,
    titleKind: row.titleKind,
    actsSummary: row.actsSummary,
    matriculas,
    fast: row.fast,
    reurb: row.reurb,
    fees: row.fees,
    feeValue: money(row.feeCents),
    notes: row.notes,
  };
}
