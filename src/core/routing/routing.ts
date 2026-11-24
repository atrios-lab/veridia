import { ATTRIBUTION_SHORT_NAMES } from "../acts/catalog.ts";
import { ATTRIBUTIONS, type Attribution } from "../tenant/schema.ts";

/**
 * The internal routing of a pedido (change direcionamento-interno-de-pedidos,
 * decisions of 23 and 24/11/2026): who at the office holds it, who sent it
 * to whom, to which sector and what for. It lives inside the office: it
 * never moves the pedido on or off "Sua mesa" (that is the office and the
 * citizen moving each other), and the citizen sees only the sector and the
 * phase, never a name.
 */

/** What a pedido is sent for. */
export const ROUTING_PURPOSES = ["execute", "review", "sign"] as const;
export type RoutingPurpose = (typeof ROUTING_PURPOSES)[number];

export const ROUTING_PURPOSE_LABELS: Record<RoutingPurpose, string> = {
  execute: "Executar o ato",
  review: "Conferência",
  sign: "Assinatura",
};

/** How the move came about: sent, taken ("Pegar para mim"), sent back. */
export const ROUTING_KINDS = ["route", "take", "return"] as const;
export type RoutingKind = (typeof ROUTING_KINDS)[number];

export const ROUTING_PRIORITIES = ["normal", "attention", "urgent"] as const;
export type RoutingPriority = (typeof ROUTING_PRIORITIES)[number];

export const ROUTING_PRIORITY_LABELS: Record<RoutingPriority, string> = {
  normal: "Normal",
  attention: "Atenção",
  urgent: "Urgente",
};

/** The longest recado, as the other short texts of the panel. */
export const ROUTING_NOTE_MAX = 1000;

/** Unreceived this long, the sender is told (the "atenção" that rises). */
export const UNRECEIVED_WARNING_MS = 2 * 60 * 60 * 1000;

// ---------------------------------------------------------------- sectors

export interface Sector {
  id: string;
  label: string;
  /** Where it came from: an attribution, the fixed ones, or the office. */
  origin: "attribution" | "internal" | "custom";
  /** Deleted by the office: kept, out of the choices. */
  hiddenAt?: string;
}

/** The sectors every office starts with, besides its attributions. */
export const INTERNAL_SECTORS: readonly { id: string; label: string }[] = [
  { id: "balcao", label: "Balcão" },
  { id: "caixa", label: "Caixa" },
  { id: "gabinete", label: "Gabinete do Tabelião" },
];

const attributionSectorId = (a: Attribution) => `atribuicao-${a.toLowerCase()}`;

/** The attribution a sector stands for, when it stands for one. */
export function sectorAttribution(id: string): Attribution | undefined {
  return ATTRIBUTIONS.find((a) => attributionSectorId(a) === id);
}

/** The sector of an attribution (the chat keeps the attendant's this way). */
export function sectorOfAttribution(a: string | null | undefined) {
  return a && (ATTRIBUTIONS as readonly string[]).includes(a)
    ? attributionSectorId(a as Attribution)
    : undefined;
}

export function defaultSectors(attributions: readonly string[]): Sector[] {
  return [
    ...ATTRIBUTIONS.filter((a) => attributions.includes(a)).map((a) => ({
      id: attributionSectorId(a),
      label: ATTRIBUTION_SHORT_NAMES[a],
      origin: "attribution" as const,
    })),
    ...INTERNAL_SECTORS.map((s) => ({ ...s, origin: "internal" as const })),
  ];
}

/** What `tenant_content` keeps under `routing-sectors`. */
export interface StoredSectors {
  sectors?: {
    id: string;
    label: string;
    origin: Sector["origin"];
    hiddenAt?: string;
    hiddenBy?: string;
    /** The labels it had before, for the history. */
    history?: { label: string; at: string; by: string }[];
  }[];
  /** userId -> the sectors that person works in. */
  members?: Record<string, string[]>;
}

/**
 * The office's sectors: what it saved, plus any default it has not saved
 * yet (an attribution it started exercising after the last edit).
 */
export function resolveSectors(
  stored: StoredSectors | null | undefined,
  attributions: readonly string[],
): Sector[] {
  const saved = stored?.sectors ?? [];
  const ids = new Set(saved.map((s) => s.id));
  return [
    ...saved.map(({ id, label, origin, hiddenAt }) => ({
      id,
      label,
      origin,
      ...(hiddenAt ? { hiddenAt } : {}),
    })),
    ...defaultSectors(attributions).filter((s) => !ids.has(s.id)),
  ];
}

export const activeSectors = (sectors: readonly Sector[]) =>
  sectors.filter((s) => !s.hiddenAt);

/** A new sector's id, from its name, never clashing with one in the list. */
export function newSectorId(label: string, taken: readonly string[]): string {
  const base =
    label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "setor";
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  return id;
}

/**
 * Who works in each sector: what the office set, or, for someone it never
 * set, the sector of the attribution they answer in the chat.
 */
export function sectorsOfUser(
  stored: StoredSectors | null | undefined,
  user: { id: string; chatSector?: string | null },
): string[] {
  const set = stored?.members?.[user.id];
  if (set) return set;
  const fromChat = sectorOfAttribution(user.chatSector);
  return fromChat ? [fromChat] : [];
}

// ---------------------------------------------------------------- routings

/** One row of `service_request_routings`, as the rules read it. */
export interface RoutingRecord {
  id: string;
  kind: RoutingKind;
  fromUserId: string | null;
  /** Null: the sector's queue. */
  toUserId: string | null;
  sectorId: string | null;
  sectorLabel: string | null;
  purpose: RoutingPurpose;
  actId: string | null;
  priority: RoutingPriority;
  dueAt: Date | null;
  note: string;
  createdBy: string;
  createdAt: Date;
  receivedAt: Date | null;
  receivedBy: string | null;
  withdrawnAt: Date | null;
}

/** The routing in force: the latest one not undone. */
export function currentRouting<T extends RoutingRecord>(
  rows: readonly T[],
): T | undefined {
  return [...rows]
    .filter((r) => !r.withdrawnAt)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}

export interface Holder {
  /** Who holds it; null while it waits in a sector's queue. */
  userId: string | null;
  /** Waiting for someone to say "Recebi". */
  pending: boolean;
  sectorId: string | null;
}

export function holderOf(routing: RoutingRecord | undefined): Holder | null {
  if (!routing) return null;
  return {
    userId: routing.receivedBy ?? routing.toUserId,
    pending: routing.receivedAt === null,
    sectorId: routing.sectorId,
  };
}

/** Whether this person can say "Recebi" to it. */
export function canReceive(
  routing: RoutingRecord,
  userId: string,
  userSectors: readonly string[],
  sectorHasMembers: boolean,
): boolean {
  if (routing.receivedAt || routing.withdrawnAt) return false;
  if (routing.toUserId) return routing.toUserId === userId;
  // The sector's queue: its people, or everyone when it has nobody yet.
  return (
    !sectorHasMembers ||
    (routing.sectorId !== null && userSectors.includes(routing.sectorId))
  );
}

/** Only who sent it changes or undoes it, and only before it is received. */
export function canChange(routing: RoutingRecord, userId: string): boolean {
  return (
    routing.kind === "route" &&
    !routing.receivedAt &&
    !routing.withdrawnAt &&
    routing.createdBy === userId
  );
}

/** Whether the sender should be told it was not received yet. */
export function unreceivedTooLong(routing: RoutingRecord, now: Date): boolean {
  return (
    !routing.receivedAt &&
    !routing.withdrawnAt &&
    now.getTime() - routing.createdAt.getTime() >= UNRECEIVED_WARNING_MS
  );
}

export function overdue(routing: RoutingRecord, now: Date): boolean {
  return Boolean(
    routing.dueAt &&
      !routing.withdrawnAt &&
      routing.dueAt.getTime() < now.getTime(),
  );
}

// ---------------------------------------------------------------- citizen

/** The andamentos in which the pedido is with the office, working. */
const WITH_THE_OFFICE = ["in-review", "payment-reported", "processing"];

const PHASE_BY_STATUS: Record<string, string> = {
  "in-review": "em análise",
  "payment-reported": "conferindo o pagamento",
  processing: "em execução do ato",
};

/**
 * The line the citizen reads under the andamento ("Com o setor de Registro
 * Civil · aguardando assinatura"), or null: off, nothing routed, no sector,
 * or the pedido is not with the office. Never a person's name.
 */
export function citizenRoutingLine(input: {
  status: string;
  routing: RoutingRecord | undefined;
  enabled: boolean;
}): string | null {
  const { status, routing } = input;
  if (!input.enabled || !routing || !routing.sectorLabel) return null;
  if (!WITH_THE_OFFICE.includes(status)) return null;
  const phase =
    routing.purpose === "sign"
      ? "aguardando assinatura"
      : routing.purpose === "review"
        ? "em conferência"
        : PHASE_BY_STATUS[status];
  return `Com o setor de ${routing.sectorLabel} · ${phase}`;
}

// ---------------------------------------------------------------- conclusion

/** Who may sign and conclude the pedidos (decision of 24/11/2026). */
export type ConclusionPolicy =
  | { mode: "all" }
  | { mode: "selected"; userIds: string[] };

export const DEFAULT_CONCLUSION_POLICY: ConclusionPolicy = { mode: "all" };

export function parseConclusionPolicy(raw: unknown): ConclusionPolicy {
  const value = raw as { mode?: unknown; userIds?: unknown } | null;
  if (value?.mode === "selected" && Array.isArray(value.userIds)) {
    const userIds = value.userIds.filter(
      (id): id is string => typeof id === "string" && id.length > 0,
    );
    if (userIds.length > 0) return { mode: "selected", userIds };
  }
  return DEFAULT_CONCLUSION_POLICY;
}

/**
 * The list as saved: the holders of the office are always in it, so the
 * office never ends up with nobody able to conclude.
 */
export function normalizeConclusionPolicy(
  policy: ConclusionPolicy,
  holderIds: readonly string[],
): ConclusionPolicy {
  if (policy.mode === "all") return policy;
  const userIds = [...new Set([...holderIds, ...policy.userIds])];
  return userIds.length > 0 ? { mode: "selected", userIds } : { mode: "all" };
}

/** Whether moving a pedido from one andamento to another concludes it. */
export function concludes(from: string, to: string): boolean {
  return (
    to === "ready-for-pickup" || (to === "done" && from !== "ready-for-pickup")
  );
}

/**
 * Whether this person may sign and conclude. The Tabelião/Registrador and
 * the platform account always may.
 */
export function mayConclude(
  policy: ConclusionPolicy,
  user: { id: string; role: string },
): boolean {
  if (policy.mode === "all") return true;
  if (user.role === "admin" || user.role === "superadmin") return true;
  return policy.userIds.includes(user.id);
}
