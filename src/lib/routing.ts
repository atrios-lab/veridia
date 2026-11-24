import "server-only";
import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { isOpenServiceRequestStatus } from "@/core/request/kinds.ts";
import {
  activeSectors,
  type ConclusionPolicy,
  canChange,
  canReceive,
  currentRouting,
  holderOf,
  mayConclude,
  newSectorId,
  normalizeConclusionPolicy,
  overdue,
  parseConclusionPolicy,
  ROUTING_NOTE_MAX,
  ROUTING_PRIORITIES,
  ROUTING_PURPOSE_LABELS,
  ROUTING_PURPOSES,
  type RoutingKind,
  type RoutingPriority,
  type RoutingPurpose,
  type RoutingRecord,
  resolveSectors,
  type Sector,
  type StoredSectors,
  sectorsOfUser,
  unreceivedTooLong,
} from "@/core/routing/routing.ts";
import { user } from "@/db/auth-schema.ts";
import type { Database } from "@/db/index.ts";
import {
  serviceRequestRoutings,
  serviceRequests,
  tenantContent,
} from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";

/**
 * The internal routing of the pedidos (change
 * direcionamento-interno-de-pedidos): the sectors, who holds each pedido,
 * who sent it where and what for, and who may sign and conclude. Nothing
 * here is deleted: a change keeps the old values, an undo is a mark.
 */

export class RoutingError extends Error {}

const SECTORS_KEY = "routing-sectors";
const CONCLUSION_KEY = "conclusion-policy";
const CITIZEN_LINE_KEY = "routing-citizen-line";

// ---------------------------------------------------------------- settings

async function readSetting<T>(
  database: Database,
  tenantSlug: string,
  key: string,
): Promise<T | null> {
  const [row] = await database
    .select({ published: tenantContent.published })
    .from(tenantContent)
    .where(
      and(eq(tenantContent.tenantSlug, tenantSlug), eq(tenantContent.key, key)),
    )
    .limit(1);
  return (row?.published as T | null) ?? null;
}

async function writeSetting(
  database: Database,
  tenantSlug: string,
  key: string,
  value: unknown,
  actorId: string,
): Promise<void> {
  await database
    .insert(tenantContent)
    .values({ tenantSlug, key, published: value, updatedBy: actorId })
    .onConflictDoUpdate({
      target: [tenantContent.tenantSlug, tenantContent.key],
      set: { published: value, updatedAt: new Date(), updatedBy: actorId },
    });
}

// ---------------------------------------------------------------- people

export interface OfficePerson {
  id: string;
  name: string;
  role: string;
  chatStatus: string;
  chatSector: string | null;
}

/** The office's active accounts (the Átrios account is never one). */
export async function officePeopleWith(
  database: Database,
  tenantSlug: string,
): Promise<OfficePerson[]> {
  return database
    .select({
      id: user.id,
      name: user.name,
      role: user.role,
      chatStatus: user.chatStatus,
      chatSector: user.chatSector,
    })
    .from(user)
    .where(
      and(
        eq(user.tenantSlug, tenantSlug),
        isNull(user.disabledAt),
        ne(user.role, "learner"),
      ),
    )
    .orderBy(user.name);
}

// ---------------------------------------------------------------- sectors

export interface SectorsView {
  sectors: Sector[];
  stored: StoredSectors | null;
}

export async function sectorsWith(
  database: Database,
  tenantSlug: string,
  attributions: readonly string[],
): Promise<SectorsView> {
  const stored = await readSetting<StoredSectors>(
    database,
    tenantSlug,
    SECTORS_KEY,
  );
  return { sectors: resolveSectors(stored, attributions), stored };
}

/** Who works in each sector, for the ones the office or the chat placed. */
export function sectorMembers(
  people: readonly OfficePerson[],
  stored: StoredSectors | null,
): Map<string, string[]> {
  const members = new Map<string, string[]>();
  for (const person of people) {
    for (const sectorId of sectorsOfUser(stored, person)) {
      members.set(sectorId, [...(members.get(sectorId) ?? []), person.id]);
    }
  }
  return members;
}

export type SectorChange =
  | { op: "create"; label: string }
  | { op: "rename"; id: string; label: string }
  | { op: "hide"; id: string }
  | { op: "restore"; id: string }
  | { op: "members"; userId: string; sectorIds: string[] };

/** Creates, renames, deletes (hides), brings back a sector, or sets who is in it. */
export async function changeSectorsWith(
  database: Database,
  tenantSlug: string,
  attributions: readonly string[],
  change: SectorChange,
  actorId: string,
): Promise<void> {
  const { sectors, stored } = await sectorsWith(
    database,
    tenantSlug,
    attributions,
  );
  const now = new Date().toISOString();
  const list = (stored?.sectors ?? []).slice();
  // Every sector in force goes into what is saved, so a later change of the
  // defaults never renames what the office already sees.
  for (const sector of sectors) {
    if (!list.some((s) => s.id === sector.id)) {
      list.push({ id: sector.id, label: sector.label, origin: sector.origin });
    }
  }
  const members = { ...(stored?.members ?? {}) };
  const find = (id: string) => {
    const sector = list.find((s) => s.id === id);
    if (!sector) throw new RoutingError("Setor não encontrado.");
    return sector;
  };
  const cleanLabel = (label: string) => {
    const value = label.trim().replace(/\s+/g, " ");
    if (value.length < 2) throw new RoutingError("Escreva o nome do setor.");
    if (value.length > 60)
      throw new RoutingError("O nome do setor pode ter até 60 letras.");
    return value;
  };
  let reason: string;
  switch (change.op) {
    case "create": {
      const label = cleanLabel(change.label);
      if (
        list.some(
          (s) =>
            !s.hiddenAt &&
            s.label.toLocaleLowerCase("pt-BR") ===
              label.toLocaleLowerCase("pt-BR"),
        )
      ) {
        throw new RoutingError("Já existe um setor com esse nome.");
      }
      const id = newSectorId(
        label,
        list.map((s) => s.id),
      );
      list.push({ id, label, origin: "custom" });
      reason = `Criou o setor ${label}`;
      break;
    }
    case "rename": {
      const sector = find(change.id);
      const label = cleanLabel(change.label);
      if (label === sector.label) return;
      sector.history = [
        ...(sector.history ?? []),
        { label: sector.label, at: now, by: actorId },
      ];
      reason = `Renomeou o setor ${sector.label} para ${label}`;
      sector.label = label;
      break;
    }
    case "hide": {
      const sector = find(change.id);
      if (sector.hiddenAt) return;
      sector.hiddenAt = now;
      sector.hiddenBy = actorId;
      reason = `Apagou o setor ${sector.label} (fica no histórico dos pedidos)`;
      break;
    }
    case "restore": {
      const sector = find(change.id);
      if (!sector.hiddenAt) return;
      delete sector.hiddenAt;
      delete sector.hiddenBy;
      reason = `Trouxe de volta o setor ${sector.label}`;
      break;
    }
    case "members": {
      const valid = change.sectorIds.filter((id) =>
        list.some((s) => s.id === id && !s.hiddenAt),
      );
      const [person] = await database
        .select({ name: user.name })
        .from(user)
        .where(and(eq(user.id, change.userId), eq(user.tenantSlug, tenantSlug)))
        .limit(1);
      if (!person) throw new RoutingError("Pessoa não encontrada.");
      members[change.userId] = valid;
      reason = `Setores de ${person.name}: ${
        valid
          .map((id) => list.find((s) => s.id === id)?.label)
          .filter(Boolean)
          .join(", ") || "nenhum"
      }`;
      break;
    }
  }
  await writeSetting(
    database,
    tenantSlug,
    SECTORS_KEY,
    { sectors: list, members } satisfies StoredSectors,
    actorId,
  );
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "office-settings.routing-sectors",
    targetType: "office-settings",
    targetId: SECTORS_KEY,
    reason,
  });
}

// ---------------------------------------------------------------- conclusion

interface StoredConclusion {
  mode: "all" | "selected";
  userIds?: string[];
  history?: { at: string; by: string; mode: string; userIds: string[] }[];
}

export async function conclusionPolicyWith(
  database: Database,
  tenantSlug: string,
): Promise<ConclusionPolicy> {
  return parseConclusionPolicy(
    await readSetting<StoredConclusion>(database, tenantSlug, CONCLUSION_KEY),
  );
}

export async function setConclusionPolicyWith(
  database: Database,
  tenantSlug: string,
  policy: ConclusionPolicy,
  actorId: string,
): Promise<ConclusionPolicy> {
  const people = await officePeopleWith(database, tenantSlug);
  const holders = people.filter((p) => p.role === "admin").map((p) => p.id);
  const known = new Set(people.map((p) => p.id));
  const next = normalizeConclusionPolicy(
    policy.mode === "all"
      ? policy
      : {
          mode: "selected",
          userIds: policy.userIds.filter((id) => known.has(id)),
        },
    holders,
  );
  const stored = await readSetting<StoredConclusion>(
    database,
    tenantSlug,
    CONCLUSION_KEY,
  );
  const previous = parseConclusionPolicy(stored);
  await writeSetting(
    database,
    tenantSlug,
    CONCLUSION_KEY,
    {
      ...next,
      history: [
        ...(stored?.history ?? []),
        {
          at: new Date().toISOString(),
          by: actorId,
          mode: previous.mode,
          userIds: previous.mode === "selected" ? previous.userIds : [],
        },
      ],
    },
    actorId,
  );
  const names = (ids: readonly string[]) =>
    ids
      .map((id) => people.find((p) => p.id === id)?.name)
      .filter(Boolean)
      .join(", ");
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "office-settings.conclusion-policy",
    targetType: "office-settings",
    targetId: CONCLUSION_KEY,
    reason:
      next.mode === "all"
        ? "Todos da equipe com acesso aos pedidos podem assinar e concluir"
        : `Só podem assinar e concluir: ${names(next.userIds)}${
            previous.mode === "selected"
              ? ` (antes: ${names(previous.userIds)})`
              : " (antes: todos)"
          }`,
  });
  return next;
}

/** Throws when this person may not conclude the pedido. */
export async function assertMayConcludeWith(
  database: Database,
  tenantSlug: string,
  person: { id: string; role: string },
): Promise<void> {
  const policy = await conclusionPolicyWith(database, tenantSlug);
  if (mayConclude(policy, person)) return;
  const people = await officePeopleWith(database, tenantSlug);
  const names =
    policy.mode === "selected"
      ? policy.userIds
          .map((id) => people.find((p) => p.id === id)?.name)
          .filter(Boolean)
          .join(", ")
      : "";
  throw new RoutingError(
    `Só ${names || "quem o Tabelião escolheu"} pode assinar e concluir os pedidos nesta serventia. Use "Direcionar" e escolha "Assinatura".`,
  );
}

// ---------------------------------------------------------------- citizen line

export async function citizenLineEnabledWith(
  database: Database,
  tenantSlug: string,
): Promise<boolean> {
  const stored = await readSetting<{ enabled?: boolean }>(
    database,
    tenantSlug,
    CITIZEN_LINE_KEY,
  );
  return stored?.enabled !== false;
}

export async function setCitizenLineWith(
  database: Database,
  tenantSlug: string,
  enabled: boolean,
  actorId: string,
): Promise<void> {
  await writeSetting(
    database,
    tenantSlug,
    CITIZEN_LINE_KEY,
    { enabled, at: new Date().toISOString(), by: actorId },
    actorId,
  );
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "office-settings.routing-citizen-line",
    targetType: "office-settings",
    targetId: CITIZEN_LINE_KEY,
    reason: enabled
      ? "Ligou a linha do setor na consulta do cidadão"
      : "Desligou a linha do setor na consulta do cidadão",
  });
}

/** The pedido's own switch: `details.routingCitizenLine`, on unless false. */
export function requestCitizenLineOn(details: unknown): boolean {
  return (
    (details as { routingCitizenLine?: unknown } | null)?.routingCitizenLine !==
    false
  );
}

export async function setRequestCitizenLineWith(
  database: Database,
  tenantSlug: string,
  requestId: string,
  enabled: boolean,
  actorId: string,
): Promise<void> {
  const [row] = await database
    .update(serviceRequests)
    .set({
      details: sql`${serviceRequests.details} || ${JSON.stringify({ routingCitizenLine: enabled })}::jsonb`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(serviceRequests.id, requestId),
        eq(serviceRequests.tenantSlug, tenantSlug),
      ),
    )
    .returning({ protocolNumber: serviceRequests.protocolNumber });
  if (!row) throw new RoutingError("Pedido não encontrado.");
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "service-request.routing-citizen-line",
    targetType: "service-request",
    targetId: requestId,
    reason: enabled
      ? `Ligou a linha do setor para o cidadão no ${row.protocolNumber}`
      : `Desligou a linha do setor para o cidadão no ${row.protocolNumber}`,
  });
}

// ---------------------------------------------------------------- routings

type RoutingRow = typeof serviceRequestRoutings.$inferSelect;

export interface RoutingView extends RoutingRecord {
  requestId: string;
  history: { at: string; by: string; before: Record<string, unknown> }[];
  withdrawnBy: string | null;
}

function toRecord(row: RoutingRow): RoutingView {
  return {
    id: row.id,
    requestId: row.requestId,
    kind: row.kind as RoutingKind,
    fromUserId: row.fromUserId,
    toUserId: row.toUserId,
    sectorId: row.sectorId,
    sectorLabel: row.sectorLabel,
    purpose: (ROUTING_PURPOSES as readonly string[]).includes(row.purpose)
      ? (row.purpose as RoutingPurpose)
      : "execute",
    actId: row.actId,
    priority: (ROUTING_PRIORITIES as readonly string[]).includes(row.priority)
      ? (row.priority as RoutingPriority)
      : "normal",
    dueAt: row.dueAt,
    note: row.note,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    receivedAt: row.receivedAt,
    receivedBy: row.receivedBy,
    withdrawnAt: row.withdrawnAt,
    withdrawnBy: row.withdrawnBy,
    history: Array.isArray(row.history)
      ? (row.history as RoutingView["history"])
      : [],
  };
}

export async function routingsOfRequestWith(
  database: Database,
  tenantSlug: string,
  requestId: string,
): Promise<RoutingView[]> {
  const rows = await database
    .select()
    .from(serviceRequestRoutings)
    .where(
      and(
        eq(serviceRequestRoutings.tenantSlug, tenantSlug),
        eq(serviceRequestRoutings.requestId, requestId),
      ),
    )
    .orderBy(desc(serviceRequestRoutings.createdAt));
  return rows.map(toRecord);
}

async function openRequest(
  database: Database,
  tenantSlug: string,
  requestId: string,
) {
  const [request] = await database
    .select({
      id: serviceRequests.id,
      protocolNumber: serviceRequests.protocolNumber,
      status: serviceRequests.status,
      kind: serviceRequests.kind,
    })
    .from(serviceRequests)
    .where(
      and(
        eq(serviceRequests.id, requestId),
        eq(serviceRequests.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);
  if (!request || request.kind !== "service-request") {
    throw new RoutingError("Pedido não encontrado.");
  }
  if (!isOpenServiceRequestStatus(request.status)) {
    throw new RoutingError(
      "Este pedido já foi encerrado: não há mais o que direcionar.",
    );
  }
  return request;
}

export interface RouteInput {
  requestId: string;
  /** Null: the sector's queue. */
  toUserId: string | null;
  sectorId: string;
  purpose: RoutingPurpose;
  actId: string | null;
  priority: RoutingPriority;
  dueAt: Date | null;
  note: string;
}

function cleanNote(note: string): string {
  const value = note.trim();
  if (value.length > ROUTING_NOTE_MAX) {
    throw new RoutingError(
      `O recado pode ter até ${ROUTING_NOTE_MAX} caracteres.`,
    );
  }
  return value;
}

/** Sends the pedido to a colleague or to a sector's queue. */
export async function routeWith(
  database: Database,
  tenantSlug: string,
  attributions: readonly string[],
  input: RouteInput,
  actorId: string,
  kind: RoutingKind = "route",
): Promise<RoutingView> {
  const request = await openRequest(database, tenantSlug, input.requestId);
  const [{ sectors }, people, routings] = await Promise.all([
    sectorsWith(database, tenantSlug, attributions),
    officePeopleWith(database, tenantSlug),
    routingsOfRequestWith(database, tenantSlug, input.requestId),
  ]);
  const sector = activeSectors(sectors).find((s) => s.id === input.sectorId);
  if (!sector) throw new RoutingError("Escolha um setor.");
  const target = input.toUserId
    ? people.find((p) => p.id === input.toUserId)
    : undefined;
  if (input.toUserId && !target) {
    throw new RoutingError("Escolha uma pessoa da equipe.");
  }
  if (!(ROUTING_PURPOSES as readonly string[]).includes(input.purpose)) {
    throw new RoutingError("Escolha para quê.");
  }
  const holder = holderOf(currentRouting(routings));
  const [row] = await database
    .insert(serviceRequestRoutings)
    .values({
      tenantSlug,
      requestId: input.requestId,
      kind,
      fromUserId: holder?.userId ?? actorId,
      toUserId: input.toUserId,
      sectorId: sector.id,
      sectorLabel: sector.label,
      purpose: input.purpose,
      actId: input.actId,
      priority: input.priority,
      dueAt: input.dueAt,
      note: cleanNote(input.note),
      createdBy: actorId,
    })
    .returning();
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action:
      kind === "return"
        ? "service-request.routing-return"
        : "service-request.routing",
    targetType: "service-request",
    targetId: input.requestId,
    reason: `${request.protocolNumber}: ${
      kind === "return" ? "devolveu" : "direcionou"
    } a ${target ? `${target.name} (${sector.label})` : `fila do setor ${sector.label}`} para ${ROUTING_PURPOSE_LABELS[input.purpose].toLocaleLowerCase("pt-BR")}`,
  });
  return toRecord(row);
}

/** "Pegar para mim": free, no release needed; whoever had it is told. */
export async function takeWith(
  database: Database,
  tenantSlug: string,
  attributions: readonly string[],
  requestId: string,
  actor: { id: string; chatSector?: string | null },
): Promise<RoutingView> {
  const request = await openRequest(database, tenantSlug, requestId);
  const [{ sectors, stored }, routings, people] = await Promise.all([
    sectorsWith(database, tenantSlug, attributions),
    routingsOfRequestWith(database, tenantSlug, requestId),
    officePeopleWith(database, tenantSlug),
  ]);
  const current = currentRouting(routings);
  const holder = holderOf(current);
  if (holder?.userId === actor.id && !holder.pending) {
    throw new RoutingError("O pedido já está com você.");
  }
  // The sector the citizen reads: the taker's own, or the one it was in.
  const mine = sectorsOfUser(stored, actor)
    .map((id) => activeSectors(sectors).find((s) => s.id === id))
    .find(Boolean);
  const sector =
    mine ??
    (current?.sectorId
      ? { id: current.sectorId, label: current.sectorLabel ?? "" }
      : undefined);
  const now = new Date();
  const [row] = await database
    .insert(serviceRequestRoutings)
    .values({
      tenantSlug,
      requestId,
      kind: "take",
      fromUserId: holder?.userId ?? null,
      toUserId: actor.id,
      sectorId: sector?.id ?? null,
      sectorLabel: sector?.label || null,
      purpose: current?.purpose ?? "execute",
      actId: current?.actId ?? null,
      priority: current?.priority ?? "normal",
      dueAt: current?.dueAt ?? null,
      note: "",
      createdBy: actor.id,
      receivedAt: now,
      receivedBy: actor.id,
    })
    .returning();
  const from = holder?.userId
    ? people.find((p) => p.id === holder.userId)?.name
    : undefined;
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "service-request.routing-take",
    targetType: "service-request",
    targetId: requestId,
    reason: `${request.protocolNumber}: pegou o pedido${from ? ` que estava com ${from}` : ""}`,
  });
  return toRecord(row);
}

/** "Recebi": the person (or the first of the sector) keeps the pedido. */
export async function receiveWith(
  database: Database,
  tenantSlug: string,
  attributions: readonly string[],
  routingId: string,
  actor: { id: string; chatSector?: string | null },
): Promise<void> {
  const [row] = await database
    .select()
    .from(serviceRequestRoutings)
    .where(
      and(
        eq(serviceRequestRoutings.id, routingId),
        eq(serviceRequestRoutings.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);
  if (!row) throw new RoutingError("Direcionamento não encontrado.");
  const routing = toRecord(row);
  const [{ stored }, people, siblings] = await Promise.all([
    sectorsWith(database, tenantSlug, attributions),
    officePeopleWith(database, tenantSlug),
    routingsOfRequestWith(database, tenantSlug, routing.requestId),
  ]);
  if (currentRouting(siblings)?.id !== routing.id) {
    throw new RoutingError("Este direcionamento já foi substituído por outro.");
  }
  const members = sectorMembers(people, stored);
  const mine = sectorsOfUser(stored, actor);
  if (
    !canReceive(
      routing,
      actor.id,
      mine,
      (members.get(routing.sectorId ?? "") ?? []).length > 0,
    )
  ) {
    throw new RoutingError(
      routing.receivedAt
        ? "Outra pessoa já recebeu este pedido."
        : "Este pedido foi direcionado a outra pessoa.",
    );
  }
  // Only one wins the sector's queue: the update holds only while nobody
  // received it yet.
  const updated = await database
    .update(serviceRequestRoutings)
    .set({ receivedAt: new Date(), receivedBy: actor.id })
    .where(
      and(
        eq(serviceRequestRoutings.id, routingId),
        isNull(serviceRequestRoutings.receivedAt),
        isNull(serviceRequestRoutings.withdrawnAt),
      ),
    )
    .returning({ id: serviceRequestRoutings.id });
  if (updated.length === 0) {
    throw new RoutingError("Outra pessoa já recebeu este pedido.");
  }
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "service-request.routing-receive",
    targetType: "service-request",
    targetId: routing.requestId,
    reason: `Recebeu o pedido para ${ROUTING_PURPOSE_LABELS[routing.purpose].toLocaleLowerCase("pt-BR")}${
      routing.toUserId ? "" : ` (fila do setor ${routing.sectorLabel ?? ""})`
    }`,
  });
}

export interface RoutingEdit {
  toUserId: string | null;
  sectorId: string;
  purpose: RoutingPurpose;
  actId: string | null;
  priority: RoutingPriority;
  dueAt: Date | null;
  note: string;
}

/** Changes a routing not received yet; the old values go to `history`. */
export async function editRoutingWith(
  database: Database,
  tenantSlug: string,
  attributions: readonly string[],
  routingId: string,
  edit: RoutingEdit,
  actorId: string,
): Promise<void> {
  const [row] = await database
    .select()
    .from(serviceRequestRoutings)
    .where(
      and(
        eq(serviceRequestRoutings.id, routingId),
        eq(serviceRequestRoutings.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);
  if (!row) throw new RoutingError("Direcionamento não encontrado.");
  const routing = toRecord(row);
  if (!canChange(routing, actorId)) {
    throw new RoutingError(
      routing.receivedAt
        ? "Já foi recebido: para mudar, direcione de novo."
        : "Só quem direcionou altera, antes de receberem.",
    );
  }
  await openRequest(database, tenantSlug, routing.requestId);
  const [{ sectors }, people] = await Promise.all([
    sectorsWith(database, tenantSlug, attributions),
    officePeopleWith(database, tenantSlug),
  ]);
  const sector = activeSectors(sectors).find((s) => s.id === edit.sectorId);
  if (!sector) throw new RoutingError("Escolha um setor.");
  if (edit.toUserId && !people.some((p) => p.id === edit.toUserId)) {
    throw new RoutingError("Escolha uma pessoa da equipe.");
  }
  const before = {
    toUserId: row.toUserId,
    sectorId: row.sectorId,
    sectorLabel: row.sectorLabel,
    purpose: row.purpose,
    actId: row.actId,
    priority: row.priority,
    dueAt: row.dueAt?.toISOString() ?? null,
    note: row.note,
  };
  await database
    .update(serviceRequestRoutings)
    .set({
      toUserId: edit.toUserId,
      sectorId: sector.id,
      sectorLabel: sector.label,
      purpose: edit.purpose,
      actId: edit.actId,
      priority: edit.priority,
      dueAt: edit.dueAt,
      note: cleanNote(edit.note),
      history: sql`${serviceRequestRoutings.history} || ${JSON.stringify([
        { at: new Date().toISOString(), by: actorId, before },
      ])}::jsonb`,
    })
    .where(eq(serviceRequestRoutings.id, routingId));
  const changed: string[] = [];
  if (before.purpose !== edit.purpose) {
    changed.push(
      `finalidade de ${ROUTING_PURPOSE_LABELS[before.purpose as RoutingPurpose]?.toLocaleLowerCase("pt-BR") ?? before.purpose} para ${ROUTING_PURPOSE_LABELS[edit.purpose].toLocaleLowerCase("pt-BR")}`,
    );
  }
  if (before.toUserId !== edit.toUserId || before.sectorId !== sector.id) {
    const name = (id: string | null) =>
      id ? (people.find((p) => p.id === id)?.name ?? "alguém") : "a fila";
    changed.push(
      `destino de ${name(before.toUserId)} (${before.sectorLabel ?? ""}) para ${name(edit.toUserId)} (${sector.label})`,
    );
  }
  if (before.priority !== edit.priority) changed.push("prioridade");
  if ((before.dueAt ?? null) !== (edit.dueAt?.toISOString() ?? null))
    changed.push("prazo");
  if (before.note !== edit.note.trim()) {
    changed.push(`recado (antes: "${before.note || "sem recado"}")`);
  }
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "service-request.routing-edit",
    targetType: "service-request",
    targetId: routing.requestId,
    reason: `Alterou: ${changed.join("; ") || "nada mudou"}`,
  });
}

/** Undoes a routing not received yet: kept, marked, out of force. */
export async function withdrawRoutingWith(
  database: Database,
  tenantSlug: string,
  routingId: string,
  actorId: string,
): Promise<void> {
  const [row] = await database
    .select()
    .from(serviceRequestRoutings)
    .where(
      and(
        eq(serviceRequestRoutings.id, routingId),
        eq(serviceRequestRoutings.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);
  if (!row) throw new RoutingError("Direcionamento não encontrado.");
  const routing = toRecord(row);
  if (!canChange(routing, actorId)) {
    throw new RoutingError(
      routing.receivedAt
        ? "Já foi recebido: para mudar, direcione de novo."
        : "Só quem direcionou desfaz, antes de receberem.",
    );
  }
  await database
    .update(serviceRequestRoutings)
    .set({ withdrawnAt: new Date(), withdrawnBy: actorId })
    .where(eq(serviceRequestRoutings.id, routingId));
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "service-request.routing-withdraw",
    targetType: "service-request",
    targetId: routing.requestId,
    reason: `Desfez o direcionamento para ${ROUTING_PURPOSE_LABELS[routing.purpose].toLocaleLowerCase("pt-BR")} (${routing.sectorLabel ?? "sem setor"})`,
  });
}

// ---------------------------------------------------------------- lists

export interface RoutedItem {
  routing: RoutingView;
  requestId: string;
  protocolNumber: string;
  applicantName: string | null;
  actId: string | null;
  status: string;
  /** "mine": with me (or to me, not received); "queue": my sector's; "sent": I sent it, not received yet. */
  bucket: "mine" | "queue" | "sent";
}

/**
 * The current routing of every open pedido of the office, read in one
 * pass: the office has a handful of open pedidos at a time.
 */
async function currentRoutingsWith(
  database: Database,
  tenantSlug: string,
): Promise<
  {
    routing: RoutingView;
    request: {
      id: string;
      protocolNumber: string;
      applicantName: string | null;
      actId: string | null;
      status: string;
    };
  }[]
> {
  const rows = await database
    .select({
      routing: serviceRequestRoutings,
      request: {
        id: serviceRequests.id,
        protocolNumber: serviceRequests.protocolNumber,
        applicantName: serviceRequests.applicantName,
        actId: serviceRequests.actId,
        status: serviceRequests.status,
      },
    })
    .from(serviceRequestRoutings)
    .innerJoin(
      serviceRequests,
      eq(serviceRequests.id, serviceRequestRoutings.requestId),
    )
    .where(
      and(
        eq(serviceRequestRoutings.tenantSlug, tenantSlug),
        isNull(serviceRequestRoutings.withdrawnAt),
      ),
    );
  const byRequest = new Map<
    string,
    { routing: RoutingView; request: (typeof rows)[number]["request"] }
  >();
  for (const row of rows) {
    if (!isOpenServiceRequestStatus(row.request.status)) continue;
    const routing = toRecord(row.routing);
    const seen = byRequest.get(routing.requestId);
    if (!seen || seen.routing.createdAt < routing.createdAt) {
      byRequest.set(routing.requestId, { routing, request: row.request });
    }
  }
  return [...byRequest.values()];
}

export async function routedToMeWith(
  database: Database,
  tenantSlug: string,
  attributions: readonly string[],
  me: { id: string; chatSector?: string | null },
): Promise<RoutedItem[]> {
  const [current, { stored }, people] = await Promise.all([
    currentRoutingsWith(database, tenantSlug),
    sectorsWith(database, tenantSlug, attributions),
    officePeopleWith(database, tenantSlug),
  ]);
  const mySectors = sectorsOfUser(stored, me);
  const members = sectorMembers(people, stored);
  const items: RoutedItem[] = [];
  for (const { routing, request } of current) {
    const holder = holderOf(routing);
    let bucket: RoutedItem["bucket"] | null = null;
    if (holder?.userId === me.id) bucket = "mine";
    else if (
      !routing.toUserId &&
      !routing.receivedAt &&
      canReceive(
        routing,
        me.id,
        mySectors,
        (members.get(routing.sectorId ?? "") ?? []).length > 0,
      )
    )
      bucket = "queue";
    else if (routing.createdBy === me.id && !routing.receivedAt)
      bucket = "sent";
    if (!bucket) continue;
    items.push({
      routing,
      requestId: request.id,
      protocolNumber: request.protocolNumber,
      applicantName: request.applicantName,
      actId: request.actId,
      status: request.status,
      bucket,
    });
  }
  const rank = { urgent: 0, attention: 1, normal: 2 } as const;
  return items.sort(
    (a, b) =>
      rank[a.routing.priority] - rank[b.routing.priority] ||
      a.routing.createdAt.getTime() - b.routing.createdAt.getTime(),
  );
}

/** What waits on me: routed to me and not received, plus my sectors' queue. */
export function waitingOnMe(items: readonly RoutedItem[]): number {
  return items.filter(
    (i) =>
      (i.bucket === "mine" && !i.routing.receivedAt) || i.bucket === "queue",
  ).length;
}

export type RoutingAlertKind = "routed" | "taken" | "unreceived" | "overdue";

export interface RoutingAlert {
  key: string;
  kind: RoutingAlertKind;
  at: string;
  protocolNumber: string;
  href: string;
  /** Who did it (or, for "unreceived", who has not received). */
  who: string;
  purpose: RoutingPurpose;
  priority: RoutingPriority;
  sectorLabel: string | null;
  note: string;
}

const TAKEN_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * The cards and tones of the routing channel for this person: a pedido sent
 * to them or their sector's queue, one taken from them, one they sent that
 * nobody received in two hours and, for the holder of the office, one past
 * its prazo.
 */
export async function routingAlertsWith(
  database: Database,
  tenantSlug: string,
  attributions: readonly string[],
  me: { id: string; chatSector?: string | null },
  seesOverdue: boolean,
  now = new Date(),
): Promise<RoutingAlert[]> {
  const [current, { stored }, people] = await Promise.all([
    currentRoutingsWith(database, tenantSlug),
    sectorsWith(database, tenantSlug, attributions),
    officePeopleWith(database, tenantSlug),
  ]);
  const name = (id: string | null) =>
    (id && people.find((p) => p.id === id)?.name) || "Alguém da equipe";
  const mySectors = sectorsOfUser(stored, me);
  const members = sectorMembers(people, stored);
  const alerts: RoutingAlert[] = [];
  const base = (
    routing: RoutingView,
    protocolNumber: string,
    kind: RoutingAlertKind,
    who: string,
    at: Date,
  ): RoutingAlert => ({
    key: `${kind}:${routing.id}`,
    kind,
    at: at.toISOString(),
    protocolNumber,
    href: `/admin/pedidos/${encodeURIComponent(protocolNumber)}`,
    who,
    purpose: routing.purpose,
    priority: routing.priority,
    sectorLabel: routing.sectorLabel,
    note: routing.note,
  });
  for (const { routing, request } of current) {
    if (
      routing.kind !== "take" &&
      canReceive(
        routing,
        me.id,
        mySectors,
        (members.get(routing.sectorId ?? "") ?? []).length > 0,
      ) &&
      routing.createdBy !== me.id
    ) {
      alerts.push(
        base(
          routing,
          request.protocolNumber,
          "routed",
          name(routing.createdBy),
          routing.createdAt,
        ),
      );
    }
    if (
      routing.kind === "take" &&
      routing.fromUserId === me.id &&
      routing.createdBy !== me.id &&
      now.getTime() - routing.createdAt.getTime() < TAKEN_WINDOW_MS
    ) {
      alerts.push(
        base(
          routing,
          request.protocolNumber,
          "taken",
          name(routing.createdBy),
          routing.createdAt,
        ),
      );
    }
    if (routing.createdBy === me.id && unreceivedTooLong(routing, now)) {
      alerts.push(
        base(
          routing,
          request.protocolNumber,
          "unreceived",
          routing.toUserId
            ? name(routing.toUserId)
            : `o setor ${routing.sectorLabel ?? ""}`,
          new Date(routing.createdAt.getTime() + 2 * 60 * 60 * 1000),
        ),
      );
    }
    if (seesOverdue && overdue(routing, now) && routing.dueAt) {
      const holder = holderOf(routing);
      alerts.push(
        base(
          routing,
          request.protocolNumber,
          "overdue",
          holder?.userId
            ? name(holder.userId)
            : `o setor ${routing.sectorLabel ?? ""}`,
          routing.dueAt,
        ),
      );
    }
  }
  return alerts;
}

/** Who held the pedido at a moment: for "deu andamento sem ser o responsável". */
export function holderAt(
  routings: readonly RoutingRecord[],
  moment: Date,
): string | null {
  const inForce = routings.filter(
    (r) =>
      r.createdAt.getTime() <= moment.getTime() &&
      (!r.withdrawnAt || r.withdrawnAt.getTime() > moment.getTime()),
  );
  const current = currentRouting(inForce);
  if (!current) return null;
  if (current.receivedAt && current.receivedAt.getTime() <= moment.getTime()) {
    return current.receivedBy;
  }
  // Sent and not received yet: it is still with whoever sent it.
  return current.fromUserId;
}
