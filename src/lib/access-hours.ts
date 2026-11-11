import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import {
  type AccessHours,
  endOfOfficeDay,
  parseAccessHours,
  validHours,
} from "@/core/auth/access-hours.ts";
import { PANEL_ROLES } from "@/core/auth/roles.ts";
import { LONG_TEXT_MAX, MIN_JUSTIFICATION } from "@/core/text-limits.ts";
import { user } from "@/db/auth-schema.ts";
import { type Database, db } from "@/db/index.ts";
import { tenantContent } from "@/db/schema.ts";
import { OFFICE_ACCESS_HOURS_KEY } from "@/lib/office-config.ts";
import { recordAuditWith } from "./audit.ts";

export class AccessHoursError extends Error {}

export async function getAccessHoursWith(
  database: Database,
  tenantSlug: string,
): Promise<AccessHours> {
  const [row] = await database
    .select({ published: tenantContent.published })
    .from(tenantContent)
    .where(
      and(
        eq(tenantContent.tenantSlug, tenantSlug),
        eq(tenantContent.key, OFFICE_ACCESS_HOURS_KEY),
      ),
    )
    .limit(1);
  return parseAccessHours(row?.published);
}

/** The office's hours; the default window if the row cannot be read. */
export async function getAccessHours(tenantSlug: string): Promise<AccessHours> {
  try {
    return await getAccessHoursWith(db, tenantSlug);
  } catch {
    return parseAccessHours(null);
  }
}

async function store(
  database: Database,
  tenantSlug: string,
  hours: AccessHours,
  actorId: string,
): Promise<void> {
  const now = new Date();
  await database
    .insert(tenantContent)
    .values({
      tenantSlug,
      key: OFFICE_ACCESS_HOURS_KEY,
      published: hours,
      publishedAt: now,
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: [tenantContent.tenantSlug, tenantContent.key],
      set: {
        published: hours,
        publishedAt: now,
        updatedAt: now,
        updatedBy: actorId,
      },
    });
}

/** The holder sets the window (or turns it off). */
export async function saveAccessWindowWith(
  database: Database,
  tenantSlug: string,
  input: { enabled: boolean; start: string; end: string },
  actorId: string,
): Promise<void> {
  if (input.enabled && !validHours(input.start, input.end)) {
    throw new AccessHoursError(
      "Confira o horário: o início vem antes do fim, no formato 07:00.",
    );
  }
  const current = await getAccessHoursWith(database, tenantSlug);
  await store(
    database,
    tenantSlug,
    {
      ...current,
      enabled: input.enabled,
      start: validHours(input.start, input.end) ? input.start : current.start,
      end: validHours(input.start, input.end) ? input.end : current.end,
    },
    actorId,
  );
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "office-settings.access-hours",
    targetType: "tenant-content",
    targetId: input.enabled
      ? `${input.start} às ${input.end}`
      : "sem limite de horário",
  });
}

/** From the closed screen: "preciso acompanhar uma demanda". */
export async function requestReleaseWith(
  database: Database,
  tenantSlug: string,
  person: { id: string; name: string },
  reason: string,
  now = new Date(),
): Promise<void> {
  const text = reason.replace(/\s+/g, " ").trim().slice(0, LONG_TEXT_MAX);
  if (text.length < MIN_JUSTIFICATION) {
    throw new AccessHoursError(
      "Diga em poucas palavras qual demanda precisa acompanhar.",
    );
  }
  const current = await getAccessHoursWith(database, tenantSlug);
  const requests = [
    ...current.requests.filter((r) => r.userId !== person.id),
    {
      userId: person.id,
      name: person.name,
      reason: text,
      at: now.toISOString(),
    },
  ];
  await store(database, tenantSlug, { ...current, requests }, person.id);
  await recordAuditWith(database, {
    tenantSlug,
    actorId: person.id,
    action: "access-hours.request",
    targetType: "user",
    targetId: person.id,
    reason: text,
  });
}

export type ReleaseDecision = "hoje" | "sempre" | "recusar" | "retirar";

/**
 * The holder answers a request, or releases or takes back someone on his
 * own: "hoje" until midnight, "sempre" until taken back.
 */
export async function decideReleaseWith(
  database: Database,
  tenantSlug: string,
  userId: string,
  decision: ReleaseDecision,
  actorId: string,
  now = new Date(),
): Promise<void> {
  const current = await getAccessHoursWith(database, tenantSlug);
  const requests = current.requests.filter((r) => r.userId !== userId);
  const until = { ...current.until };
  let always = current.always.filter((id) => id !== userId);
  delete until[userId];
  if (decision === "hoje") until[userId] = endOfOfficeDay(now).toISOString();
  if (decision === "sempre") always = [...always, userId];
  await store(
    database,
    tenantSlug,
    { ...current, requests, until, always },
    actorId,
  );
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action:
      decision === "recusar"
        ? "access-hours.deny"
        : decision === "retirar"
          ? "access-hours.revoke"
          : "access-hours.release",
    targetType: "user",
    targetId: userId,
    reason:
      decision === "hoje"
        ? "Liberado fora do horário até o fim do dia"
        : decision === "sempre"
          ? "Liberado fora do horário até ser retirado"
          : undefined,
  });
}

/** The office's active people the hours apply to (not the holder). */
export async function listPeopleWith(
  database: Database,
  tenantSlug: string,
): Promise<{ id: string; name: string; role: string }[]> {
  const rows = await database
    .select({ id: user.id, name: user.name, role: user.role })
    .from(user)
    .where(
      and(
        eq(user.tenantSlug, tenantSlug),
        inArray(
          user.role,
          PANEL_ROLES.filter((role) => role !== "admin"),
        ),
        isNull(user.disabledAt),
      ),
    )
    .orderBy(asc(user.name));
  return rows.map((row) => ({ ...row, role: row.role ?? "" }));
}
