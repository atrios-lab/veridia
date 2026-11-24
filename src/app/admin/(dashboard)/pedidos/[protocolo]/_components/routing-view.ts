import "server-only";
import { ATTRIBUTION_NAMES, actsOfTenant } from "@/core/acts/catalog.ts";
import { isOpenServiceRequestStatus } from "@/core/request/kinds.ts";
import {
  activeSectors,
  canChange,
  canReceive,
  citizenRoutingLine,
  currentRouting,
  holderOf,
  mayConclude,
  overdue,
  ROUTING_PURPOSE_LABELS,
  type RoutingPurpose,
  sectorsOfUser,
} from "@/core/routing/routing.ts";
import { toZonedDateTimeInput } from "@/core/scheduling/calendar.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { formatOfficeDayMonthTime } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import {
  citizenLineEnabledWith,
  conclusionPolicyWith,
  holderAt,
  officePeopleWith,
  requestCitizenLineOn,
  routingsOfRequestWith,
  sectorMembers,
  sectorsWith,
} from "@/lib/routing.ts";
import type { RequestHistoryEntry } from "@/lib/service-request.ts";
import { OFFICE_TIME_ZONE } from "@/lib/tenant.ts";
import type {
  RoutingCurrent,
  RoutingHistoryEntry,
  RoutingPerson,
} from "./routing-card.tsx";

const initials = (name: string | null | undefined) =>
  (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

const purposeWord = (p: RoutingPurpose) =>
  ROUTING_PURPOSE_LABELS[p].toLocaleLowerCase("pt-BR");

/**
 * What the pedido's "Direcionamento" card shows, read on the server: the
 * current holder, the history of every move, the choices of the window and
 * who may conclude. Also says which andamentos were given by someone who
 * was not holding the pedido at the time.
 */
export async function routingCardData(input: {
  tenant: Tenant;
  request: { id: string; status: string; details: unknown };
  me: { id: string; role: string; chatSector?: string | null };
  history: readonly RequestHistoryEntry[];
}) {
  const { tenant, request, me } = input;
  const [routings, { sectors, stored }, people, policy, officeLine] =
    await Promise.all([
      routingsOfRequestWith(db, tenant.slug, request.id),
      sectorsWith(db, tenant.slug, tenant.attributions),
      officePeopleWith(db, tenant.slug),
      conclusionPolicyWith(db, tenant.slug),
      citizenLineEnabledWith(db, tenant.slug),
    ]);
  const nameOf = (id: string | null | undefined) =>
    (id && people.find((p) => p.id === id)?.name) || null;
  const members = sectorMembers(people, stored);
  const mySectors = sectorsOfUser(stored, me);
  const now = new Date();
  const current = currentRouting(routings);
  const holder = holderOf(current);
  const services = actsOfTenant(tenant).map((act) => ({
    id: act.id,
    name: act.name,
    group: ATTRIBUTION_NAMES[act.attribution],
  }));
  const serviceName = (id: string | null) =>
    id ? (services.find((s) => s.id === id)?.name ?? null) : null;

  const currentView: RoutingCurrent | null = current
    ? {
        id: current.id,
        holderName: nameOf(holder?.userId),
        holderInitials: holder?.userId ? initials(nameOf(holder.userId)) : "▢",
        sectorLabel: current.sectorLabel,
        sectorId: current.sectorId,
        toUserId: current.toUserId,
        purpose: current.purpose,
        priority: current.priority,
        actId: current.actId,
        serviceName: serviceName(current.actId),
        dueLabel: current.dueAt
          ? formatOfficeDayMonthTime(current.dueAt)
          : null,
        dueInput: current.dueAt
          ? toZonedDateTimeInput(current.dueAt, OFFICE_TIME_ZONE)
          : "",
        overdue: overdue(current, now),
        note: current.note,
        pending: holder?.pending ?? false,
        receivedLabel: current.receivedAt
          ? formatOfficeDayMonthTime(current.receivedAt)
          : null,
        canReceive: canReceive(
          current,
          me.id,
          mySectors,
          (members.get(current.sectorId ?? "") ?? []).length > 0,
        ),
        canChange: canChange(current, me.id),
        canReturn:
          holder?.userId === me.id &&
          !holder.pending &&
          Boolean(current.fromUserId) &&
          current.fromUserId !== me.id &&
          Boolean(current.sectorId),
        mine: holder?.userId === me.id,
      }
    : null;

  // Every move, newest first; an andamento given by someone not holding
  // the pedido shows here too.
  const entries: (RoutingHistoryEntry & { at: Date })[] = [];
  for (const r of routings) {
    const by = nameOf(r.createdBy) ?? "Alguém da equipe";
    const to = r.toUserId
      ? (nameOf(r.toUserId) ?? "alguém")
      : `fila do setor ${r.sectorLabel ?? ""}`;
    const text =
      r.kind === "take"
        ? `${by} pegou o pedido${r.fromUserId && r.fromUserId !== r.createdBy ? ` que estava com ${nameOf(r.fromUserId) ?? "um colega"}` : ""}`
        : r.kind === "return"
          ? `${by} devolveu a ${to}`
          : `${by} direcionou a ${to}${r.toUserId && r.sectorLabel ? ` (${r.sectorLabel})` : ""} para ${purposeWord(r.purpose)}`;
    entries.push({
      key: `r-${r.id}`,
      text,
      at: r.createdAt,
      atLabel: formatOfficeDayMonthTime(r.createdAt),
      note: r.note || undefined,
      struck: Boolean(r.withdrawnAt),
    });
    for (const [i, edit] of r.history.entries()) {
      const before = edit.before as { purpose?: string };
      entries.push({
        key: `e-${r.id}-${i}`,
        text: `${nameOf(edit.by) ?? "Alguém"} alterou${
          before.purpose && before.purpose !== r.purpose
            ? `: finalidade de ${purposeWord(before.purpose as RoutingPurpose)} para ${purposeWord(r.purpose)}`
            : " o direcionamento"
        }`,
        at: new Date(edit.at),
        atLabel: formatOfficeDayMonthTime(new Date(edit.at)),
        tone: "edit",
      });
    }
    if (r.receivedAt && r.kind !== "take") {
      entries.push({
        key: `v-${r.id}`,
        text: `${nameOf(r.receivedBy) ?? "Alguém"} recebeu`,
        at: r.receivedAt,
        atLabel: formatOfficeDayMonthTime(r.receivedAt),
      });
    }
    if (r.withdrawnAt) {
      entries.push({
        key: `w-${r.id}`,
        text: `${nameOf(r.withdrawnBy) ?? "Alguém"} desfez o direcionamento`,
        at: r.withdrawnAt,
        atLabel: formatOfficeDayMonthTime(r.withdrawnAt),
        tone: "edit",
      });
    }
  }
  const notHolder = new Set<number>();
  input.history.forEach((entry, index) => {
    if (entry.action !== "service-request.status" || !entry.actorId) return;
    const atThatTime = holderAt(routings, entry.createdAt);
    if (atThatTime && atThatTime !== entry.actorId) {
      notHolder.add(index);
      entries.push({
        key: `s-${index}`,
        text: `${entry.actorName ?? "Alguém"} deu andamento sem ser o responsável (estava com ${nameOf(atThatTime) ?? "um colega"})`,
        at: entry.createdAt,
        atLabel: formatOfficeDayMonthTime(entry.createdAt),
        tone: "warn",
      });
    }
  });
  entries.sort((a, b) => b.at.getTime() - a.at.getTime());

  const restricted = policy.mode === "selected";
  const routingPeople: RoutingPerson[] = people.map((p) => ({
    id: p.id,
    name: p.name,
    initials: initials(p.name),
    sectorIds: sectorsOfUser(stored, p),
    available: p.chatStatus === "available",
    mayConclude: mayConclude(policy, p),
  }));
  const signers = routingPeople.filter((p) => p.mayConclude);
  const requestLine = requestCitizenLineOn(request.details);

  return {
    card: {
      open: isOpenServiceRequestStatus(request.status),
      current: currentView,
      history: entries.map(({ at: _at, ...rest }) => rest),
      people: routingPeople,
      sectors: activeSectors(sectors).map(({ id, label }) => ({ id, label })),
      services,
      restricted,
      citizenLine: {
        office: officeLine,
        request: requestLine,
        preview: citizenRoutingLine({
          status: request.status,
          routing: current,
          enabled: officeLine && requestLine,
        }),
      },
    },
    /** Indexes of the page's history given by someone not holding it. */
    notHolder,
    /** Who may conclude, when the office restricted it; null otherwise. */
    lockedFor: mayConclude(policy, me)
      ? null
      : signers.map((p) => p.name).join(", ") || "quem o Tabelião escolheu",
  };
}
