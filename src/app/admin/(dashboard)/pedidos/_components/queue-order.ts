// Relative on purpose: node --test loads this file and knows no "@/".
import type { DeadlineUrgency } from "../../../../../core/overview/urgency.ts";
import type { ServiceRequestStatus } from "../../../../../core/request/kinds.ts";
import {
  ATTRIBUTIONS,
  type Attribution,
} from "../../../../../core/tenant/schema.ts";
import type { Tone } from "./status-tone.ts";

/**
 * The tabs the queue is read in, left to right: one per andamento still
 * open, then Finalizados for everything over, whatever the ending. The tab
 * is the andamento, so the row no longer says it; the tone only colours the
 * counter of the active tab, the way the badge used to colour the row.
 *
 * "Pagamento informado" has a tab of its own although the design showed
 * seven: it is the one andamento where the citizen says the money went out
 * and the office has not looked yet, and folding it into "Pago" would hide
 * exactly that from the person scanning the tabs. Eight tabs have to fit on
 * one line, so the long labels carry a short form for a narrow row (see
 * queue-tabs.tsx).
 */
export type QueueTabId =
  | "new"
  | "awaiting-compliance"
  | "awaiting-payment"
  | "payment-reported"
  | "paid"
  | "processing"
  | "ready-for-pickup"
  | "closed";

export interface QueueTab {
  id: QueueTabId;
  label: string;
  /** What the tab says when the row is too narrow for the full label. */
  shortLabel?: string;
  tone: Tone;
  statuses: readonly ServiceRequestStatus[];
}

export const CLOSED_TAB: QueueTabId = "closed";

export const QUEUE_TABS: readonly QueueTab[] = [
  { id: "new", label: "Novo", tone: "waiting", statuses: ["new"] },
  {
    id: "awaiting-compliance",
    label: "Aguardando exigência",
    shortLabel: "Exigência",
    tone: "blocked",
    statuses: ["awaiting-compliance"],
  },
  {
    id: "awaiting-payment",
    label: "Aguardando pagamento",
    shortLabel: "Aguard. pagamento",
    tone: "waiting",
    statuses: ["awaiting-payment"],
  },
  {
    id: "payment-reported",
    label: "Pagamento informado",
    shortLabel: "Pgto. informado",
    tone: "waiting",
    statuses: ["payment-reported"],
  },
  { id: "paid", label: "Pago", tone: "working", statuses: ["paid"] },
  {
    id: "processing",
    label: "Em andamento",
    tone: "working",
    statuses: ["processing"],
  },
  {
    id: "ready-for-pickup",
    label: "Disponível p/ retirada",
    shortLabel: "P/ retirada",
    tone: "delivered",
    statuses: ["ready-for-pickup"],
  },
  {
    id: CLOSED_TAB,
    label: "Finalizados",
    tone: "closed",
    statuses: ["done", "rejected", "cancelled", "archived"],
  },
];

export function isQueueTabId(value: string): value is QueueTabId {
  return QUEUE_TABS.some((tab) => tab.id === value);
}

export function queueTab(id: QueueTabId): QueueTab {
  const tab = QUEUE_TABS.find((t) => t.id === id);
  if (!tab) throw new Error(`Aba desconhecida: ${id}`);
  return tab;
}

export function queueTabOf(status: ServiceRequestStatus): QueueTabId {
  const tab = QUEUE_TABS.find((t) => t.statuses.includes(status));
  // Every one of the eleven andamentos is listed above; a twelfth would be
  // a type error in QUEUE_TABS long before it got here.
  return tab?.id ?? CLOSED_TAB;
}

export const PAGE_SIZES = [10, 25, 50] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 10;

/** The queue's whole server state, as read from and written to the URL. */
export interface QueueQuery {
  tab: QueueTabId;
  attribution?: Attribution;
  search?: string;
  page: number;
  size: PageSize;
}

/**
 * The URL, validated. Anything the URL got wrong falls back to the default
 * rather than to an error page: a stale bookmark with an andamento that no
 * longer exists should open the queue, not a 404.
 */
export function queueSearchParams(
  raw: {
    aba?: string;
    atribuicao?: string;
    q?: string;
    pagina?: string;
    por?: string;
  },
  attributions: readonly Attribution[] = ATTRIBUTIONS,
): QueueQuery {
  const tab = raw.aba && isQueueTabId(raw.aba) ? raw.aba : "new";
  const attribution =
    raw.atribuicao &&
    (attributions as readonly string[]).includes(raw.atribuicao)
      ? (raw.atribuicao as Attribution)
      : undefined;
  const search = raw.q?.trim() || undefined;
  const size = (PAGE_SIZES as readonly number[]).includes(Number(raw.por))
    ? (Number(raw.por) as PageSize)
    : DEFAULT_PAGE_SIZE;
  const page =
    raw.pagina && /^\d+$/.test(raw.pagina) && Number(raw.pagina) >= 1
      ? Number(raw.pagina)
      : 1;
  return { tab, attribution, search, page, size };
}

export function pageCount(total: number, size: number): number {
  return Math.max(1, Math.ceil(total / size));
}

/** The page that actually exists: past the end lands on the last page
 * (archiving the only row of page 3 should show page 2, not nothing). */
export function clampPage(page: number, total: number, size: number): number {
  return Math.min(Math.max(1, page), pageCount(total, size));
}

export function pageSlice<T>(
  rows: readonly T[],
  page: number,
  size: number,
): T[] {
  const start = (page - 1) * size;
  return rows.slice(start, start + size);
}

export const QUEUE_PATH = "/admin/pedidos";

/**
 * The queue's URL with a patch applied. Defaults are left out so the plain
 * `/admin/pedidos` stays the address of the first tab. Changing the tab, the
 * filter, the search or the page size goes back to page 1 unless the patch
 * says otherwise: page 3 of one tab means nothing on another.
 */
export function queueHref(
  current: QueueQuery,
  patch: Partial<QueueQuery> = {},
): string {
  const resetsPage =
    "tab" in patch ||
    "attribution" in patch ||
    "search" in patch ||
    "size" in patch;
  const next: QueueQuery = {
    ...current,
    ...patch,
    page: patch.page ?? (resetsPage ? 1 : current.page),
  };
  const params = new URLSearchParams();
  if (next.tab !== "new") params.set("aba", next.tab);
  if (next.attribution) params.set("atribuicao", next.attribution);
  if (next.search) params.set("q", next.search);
  if (next.size !== DEFAULT_PAGE_SIZE) params.set("por", String(next.size));
  if (next.page > 1) params.set("pagina", String(next.page));
  const query = params.toString();
  return query ? `${QUEUE_PATH}?${query}` : QUEUE_PATH;
}

export const PAGE_GAP = "…";

/**
 * Which page numbers to draw: all of them up to seven, and past that the
 * first, the last and a window of three around the current one, with a gap
 * where pages are skipped. Seven is where a row of 32px buttons stops
 * fitting beside the "Exibindo…" text at the design's width.
 */
export function pageWindow(
  current: number,
  count: number,
): (number | typeof PAGE_GAP)[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const pages = new Set<number>([1, count]);
  for (let n = current - 1; n <= current + 1; n++) {
    if (n >= 1 && n <= count) pages.add(n);
  }
  // Keep a window of five where the ends would leave it short.
  if (current <= 3) for (let n = 2; n <= 5; n++) pages.add(n);
  if (current >= count - 2)
    for (let n = count - 4; n < count; n++) pages.add(n);
  const sorted = [...pages]
    .filter((n) => n >= 1 && n <= count)
    .sort((a, b) => a - b);
  const out: (number | typeof PAGE_GAP)[] = [];
  for (const [i, n] of sorted.entries()) {
    const previous = sorted[i - 1];
    if (previous !== undefined && n - previous > 1) out.push(PAGE_GAP);
    out.push(n);
  }
  return out;
}

export interface QueueRowOrder {
  urgency: DeadlineUrgency;
  createdAt: Date;
}

const URGENCY_RANK: Record<DeadlineUrgency["kind"], number> = {
  overdue: 0,
  "due-soon": 1,
  paused: 2,
  running: 3,
  closed: 4,
};

/**
 * The order inside an open tab: the latest term first, then the one closest
 * to its term, then the paused ones with the longest wait on the citizen
 * first (the one closest to lapsing is the one worth a telephone call); ties
 * by arrival, oldest first, which is the order the office promises the
 * citizen it works in.
 *
 * Finalizados is not sorted here: there nobody is queueing, the last thing
 * finished is the one still being asked about, and "newest first" is an
 * ORDER BY the database runs before paging.
 */
export function compareQueueRows(a: QueueRowOrder, b: QueueRowOrder): number {
  const byUrgency = URGENCY_RANK[a.urgency.kind] - URGENCY_RANK[b.urgency.kind];
  if (byUrgency !== 0) return byUrgency;
  if (a.urgency.kind === "overdue" && b.urgency.kind === "overdue") {
    if (a.urgency.daysLate !== b.urgency.daysLate)
      return b.urgency.daysLate - a.urgency.daysLate;
  }
  if (a.urgency.kind === "due-soon" && b.urgency.kind === "due-soon") {
    if (a.urgency.daysLeft !== b.urgency.daysLeft)
      return a.urgency.daysLeft - b.urgency.daysLeft;
  }
  if (a.urgency.kind === "paused" && b.urgency.kind === "paused") {
    if (a.urgency.waitingDays !== b.urgency.waitingDays)
      return b.urgency.waitingDays - a.urgency.waitingDays;
  }
  return a.createdAt.getTime() - b.createdAt.getTime();
}
