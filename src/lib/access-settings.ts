import "server-only";
import { and, asc, eq, isNull, ne } from "drizzle-orm";
import {
  type OfficeAccess,
  parseOfficeAccess,
} from "@/core/auth/access-settings.ts";
import { user } from "@/db/auth-schema.ts";
import { type Database, db } from "@/db/index.ts";
import { tenantContent } from "@/db/schema.ts";
import { OFFICE_ACCESS_KEY } from "@/lib/office-config.ts";
import { recordAuditWith } from "./audit.ts";

export async function getOfficeAccessWith(
  database: Database,
  tenantSlug: string,
): Promise<OfficeAccess> {
  const [row] = await database
    .select({ published: tenantContent.published })
    .from(tenantContent)
    .where(
      and(
        eq(tenantContent.tenantSlug, tenantSlug),
        eq(tenantContent.key, OFFICE_ACCESS_KEY),
      ),
    )
    .limit(1);
  return parseOfficeAccess(row?.published);
}

export function getOfficeAccess(tenantSlug: string): Promise<OfficeAccess> {
  return getOfficeAccessWith(db, tenantSlug);
}

async function save(
  database: Database,
  tenantSlug: string,
  access: OfficeAccess,
  actorId: string,
  what: string,
): Promise<void> {
  const published = { users: access };
  await database
    .insert(tenantContent)
    .values({
      tenantSlug,
      key: OFFICE_ACCESS_KEY,
      published,
      publishedAt: new Date(),
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: [tenantContent.tenantSlug, tenantContent.key],
      set: {
        published,
        publishedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: actorId,
      },
    });
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "office-settings.save",
    targetType: "tenant-content",
    targetId: `${OFFICE_ACCESS_KEY}:${what}`,
  });
}

/** Sets where this person's code goes; empty goes back to the account's e-mail. */
export async function setCodeEmailWith(
  database: Database,
  tenantSlug: string,
  userId: string,
  email: string | undefined,
  actorId: string,
): Promise<void> {
  const access = await getOfficeAccessWith(database, tenantSlug);
  const { email: _previous, ...rest } = access[userId] ?? {};
  const next = email ? { ...rest, email } : rest;
  await save(
    database,
    tenantSlug,
    { ...access, [userId]: next },
    actorId,
    `${userId}:email`,
  );
}

/** Every computer this person saved asks for the code again. */
export async function forgetSavedComputersWith(
  database: Database,
  tenantSlug: string,
  userId: string,
  actorId: string,
): Promise<void> {
  const access = await getOfficeAccessWith(database, tenantSlug);
  const current = access[userId] ?? {};
  await save(
    database,
    tenantSlug,
    { ...access, [userId]: { ...current, epoch: (current.epoch ?? 0) + 1 } },
    actorId,
    `${userId}:computadores`,
  );
}

/** The office's active accounts that go through the code (no Átrios account). */
export async function officeAccountsWith(
  database: Database,
  tenantSlug: string,
): Promise<{ id: string; name: string; email: string; role: string }[]> {
  return database
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    })
    .from(user)
    .where(
      and(
        eq(user.tenantSlug, tenantSlug),
        ne(user.role, "superadmin"),
        isNull(user.disabledAt),
      ),
    )
    .orderBy(asc(user.name));
}
