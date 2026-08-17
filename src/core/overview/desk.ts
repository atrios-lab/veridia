import { dataRightOption, manifestationLabel } from "../request/channels.ts";
import type {
  DataRight,
  ManifestationType,
  RequestKind,
} from "../request/kinds.ts";
import type { IsoDate } from "../scheduling/calendar.ts";
import type { SlotTime } from "../scheduling/slots.ts";
import { dataRightsUrgency } from "./urgency.ts";

/** Where each kind's detail screen lives (the mesa's next-step link and the
 * "Situação dos canais" block route through the same table). */
export const ROUTE_BY_KIND: Record<RequestKind, string> = {
  "service-request": "/admin/pedidos",
  appointment: "/admin/agenda",
  "data-rights": "/admin/lgpd",
  ombudsman: "/admin/ouvidoria",
};

function detailHref(kind: RequestKind, protocolNumber: string): string {
  return `${ROUTE_BY_KIND[kind]}/${encodeURIComponent(protocolNumber)}`;
}

/**
 * One open record of any channel, with just enough kind-specific detail to
 * rank it and word its row. A flat shape rather than a discriminated union:
 * the caller already knows which fields apply to which kind (it read them
 * out of `details`), and a union buys type narrowing this module does not
 * need in exchange for four constructors instead of one.
 */
export interface DeskItemInput {
  kind: RequestKind;
  protocolNumber: string;
  applicantName: string | null;
  status: string;
  createdAt: Date;
  /** data-rights only: the day the request was filed, for the legal term. */
  requestedOn?: IsoDate;
  right?: DataRight;
  /** service-request only: exigência cumprida, andamento parado desde então. */
  hasFulfilledPendingRequirement?: boolean;
  /** ombudsman only. */
  manifestationType?: ManifestationType;
}

export type DeskChipTone = "error" | "warning" | "neutral";

export interface RankedDeskItem {
  kind: RequestKind;
  protocolNumber: string;
  displayName: string;
  summary: string;
  chipLabel: string;
  chipTone: DeskChipTone;
  actionLabel: string;
  actionHref: string;
}

interface RankedDeskItemInternal extends RankedDeskItem {
  /** Lower sorts first. 1: LGPD perto do prazo/vencido, 2: REQ exigência
   * cumprida, 4: todo o resto. */
  tier: 1 | 2 | 4;
  /** Lower sorts first, within the same tier. */
  tieBreak: number;
}

const DESK_LIMIT = 6;

function elapsedChipLabel(createdAt: Date, now: Date): string {
  const minutes = Math.max(
    0,
    Math.floor((now.getTime() - createdAt.getTime()) / 60_000),
  );
  if (minutes < 60) return "novo";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days} dia${days === 1 ? "" : "s"}`;
}

function dataRightsChipLabel(
  urgency: ReturnType<typeof dataRightsUrgency>,
): string {
  switch (urgency.kind) {
    case "overdue":
      return `venceu há ${urgency.daysLate} dia${urgency.daysLate === 1 ? "" : "s"}`;
    case "due-soon":
      return urgency.daysLeft <= 0
        ? "vence hoje"
        : `vence em ${urgency.daysLeft}d`;
    default:
      return "recebido";
  }
}

function displayName(item: DeskItemInput): string {
  if (item.applicantName) return item.applicantName;
  return item.kind === "ombudsman" ? "manifestação anônima" : "Não informado";
}

function defaultSummary(item: DeskItemInput): string {
  switch (item.kind) {
    case "service-request":
      return "Novo pedido de serviço";
    case "ombudsman":
      return item.manifestationType
        ? manifestationLabel(item.manifestationType)
        : "Manifestação registrada";
    // Appointments no longer reach the desk: one that is booked is settled,
    // and nothing about it waits on the office. It is kept in the union
    // because the kind still exists on dormant rows.
    case "appointment":
      return "Agendamento";
    case "data-rights":
      return "Requerimento LGPD";
  }
}

function defaultActionLabel(item: DeskItemInput): string {
  switch (item.kind) {
    case "service-request":
      return item.status === "new" ? "Iniciar análise" : "Ver pedido";
    case "ombudsman":
      return item.status === "new" ? "Ler manifestação" : "Ver manifestação";
    case "appointment":
      return "Ver agenda";
    case "data-rights":
      return "Responder";
  }
}

function rankOne(
  item: DeskItemInput,
  today: IsoDate,
  now: Date,
): RankedDeskItemInternal {
  const href = detailHref(item.kind, item.protocolNumber);
  const name = displayName(item);
  const createdAtMs = item.createdAt.getTime();

  if (item.kind === "data-rights" && item.requestedOn) {
    const urgency = dataRightsUrgency(item.status, item.requestedOn, today);
    const critical = urgency.kind === "due-soon" || urgency.kind === "overdue";
    return {
      kind: item.kind,
      protocolNumber: item.protocolNumber,
      displayName: name,
      summary: item.right
        ? `Requerimento LGPD · ${dataRightOption(item.right).summary}`
        : "Requerimento LGPD",
      chipLabel: dataRightsChipLabel(urgency),
      chipTone: critical ? "error" : "neutral",
      actionLabel: "Responder agora",
      actionHref: href,
      tier: critical ? 1 : 4,
      tieBreak:
        critical && urgency.kind === "overdue"
          ? -urgency.daysLate
          : critical && urgency.kind === "due-soon"
            ? urgency.daysLeft
            : createdAtMs,
    };
  }

  if (item.kind === "service-request" && item.hasFulfilledPendingRequirement) {
    return {
      kind: item.kind,
      protocolNumber: item.protocolNumber,
      displayName: name,
      summary:
        "Exigência cumprida pelo cidadão, aguardando retomada da análise",
      chipLabel: elapsedChipLabel(item.createdAt, now),
      chipTone: "warning",
      actionLabel: "Retomar análise",
      actionHref: href,
      tier: 2,
      tieBreak: createdAtMs,
    };
  }

  return {
    kind: item.kind,
    protocolNumber: item.protocolNumber,
    displayName: name,
    summary: defaultSummary(item),
    chipLabel: elapsedChipLabel(item.createdAt, now),
    chipTone: "neutral",
    actionLabel: defaultActionLabel(item),
    actionHref: href,
    tier: 4,
    tieBreak: createdAtMs,
  };
}

/**
 * The mesa de trabalho: every open item across the channels, ranked by
 * urgency (LGPD perto do prazo/vencido, then REQ com exigência cumprida,
 * then o resto, mais antigo primeiro) and cut to the most urgent
 * `DESK_LIMIT`. Agendamentos não entram: um horário marcado já está
 * resolvido. The rest stays reachable through
 * "Situação dos canais", never silently dropped from the panel.
 */
export function rankDeskItems(
  items: readonly DeskItemInput[],
  today: IsoDate,
  now: Date,
): RankedDeskItem[] {
  return items
    .map((item) => rankOne(item, today, now))
    .sort((a, b) => a.tier - b.tier || a.tieBreak - b.tieBreak)
    .slice(0, DESK_LIMIT)
    .map(({ tier: _tier, tieBreak: _tieBreak, ...rest }) => rest);
}

/** How many mesa items are a LGPD deadline due soon or overdue: the
 * header's "prazo crítico" count, over every open item, not just the ones
 * the mesa has room to show. */
export function countCriticalDeskItems(
  items: readonly DeskItemInput[],
  today: IsoDate,
): number {
  return items.filter((item) => {
    if (item.kind !== "data-rights" || !item.requestedOn) return false;
    const urgency = dataRightsUrgency(item.status, item.requestedOn, today);
    return urgency.kind === "due-soon" || urgency.kind === "overdue";
  }).length;
}

export type TodayAppointmentState = "done" | "next" | "upcoming";

export interface TodayAppointmentInput {
  id: string;
  citizenName: string;
  serviceLabel: string;
  slotTime: SlotTime;
  status: string;
}

export interface RankedTodayAppointment extends TodayAppointmentInput {
  state: TodayAppointmentState;
}

/**
 * The day's compromissos in order, with the next one still ahead
 * highlighted. Nothing here waits on the office to confirm: every
 * appointment on this list is already the office's word.
 */
export function rankTodayAppointments(
  items: readonly TodayAppointmentInput[],
  nowTime: SlotTime,
): RankedTodayAppointment[] {
  // Zero padded "HH:mm" sorts and compares correctly as text.
  const sorted = [...items].sort((a, b) =>
    a.slotTime.localeCompare(b.slotTime),
  );
  let nextAssigned = false;
  return sorted.map((item) => {
    if (item.status === "attended" || item.slotTime < nowTime) {
      return { ...item, state: "done" as const };
    }
    if (!nextAssigned) {
      nextAssigned = true;
      return { ...item, state: "next" as const };
    }
    return { ...item, state: "upcoming" as const };
  });
}
