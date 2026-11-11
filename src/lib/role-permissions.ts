import "server-only";
import { and, eq } from "drizzle-orm";
import {
  GRANTABLE_PERMISSIONS,
  PANEL_ROLES,
  type PanelRole,
  withDerived,
} from "@/core/auth/roles.ts";
import { type Database, db } from "@/db/index.ts";
import { tenantContent } from "@/db/schema.ts";
import { OFFICE_ROLE_PERMISSIONS_KEY } from "@/lib/office-config.ts";
import { recordAuditWith } from "./audit.ts";

/**
 * What each position of the office may do, as the Tabelião/Registrador set
 * it (Configurações › Perfis e permissões). A position never set keeps its
 * defaults (core/auth/roles.ts); the holder's own is never stored.
 */
export type RolePermissions = Partial<Record<PanelRole, string[]>>;

function parse(raw: unknown): RolePermissions {
  const result: RolePermissions = {};
  if (!raw || typeof raw !== "object") return result;
  // The permissions that existed when the office saved this. One created
  // after it starts as the one it was split from (roles.ts DERIVED_FROM),
  // so a new line never takes away what someone could do the day before.
  const knownRaw = (raw as Record<string, unknown>).known;
  const known = Array.isArray(knownRaw) ? knownRaw.map(String) : [];
  for (const role of PANEL_ROLES) {
    if (role === "admin") continue;
    const list = (raw as Record<string, unknown>)[role];
    if (!Array.isArray(list)) continue;
    result[role] = withDerived(
      list
        .map(String)
        .filter((item) =>
          (GRANTABLE_PERMISSIONS as readonly string[]).includes(item),
        ),
      known,
    ).filter((item) =>
      (GRANTABLE_PERMISSIONS as readonly string[]).includes(item),
    );
  }
  return result;
}

export async function getRolePermissionsWith(
  database: Database,
  tenantSlug: string,
): Promise<RolePermissions> {
  const [row] = await database
    .select({ published: tenantContent.published })
    .from(tenantContent)
    .where(
      and(
        eq(tenantContent.tenantSlug, tenantSlug),
        eq(tenantContent.key, OFFICE_ROLE_PERMISSIONS_KEY),
      ),
    )
    .limit(1);
  return parse(row?.published);
}

export async function getRolePermissions(
  tenantSlug: string,
): Promise<RolePermissions> {
  try {
    return await getRolePermissionsWith(db, tenantSlug);
  } catch {
    // Unreadable: every position falls back to its defaults.
    return {};
  }
}

export async function saveRolePermissionsWith(
  database: Database,
  tenantSlug: string,
  permissions: RolePermissions,
  actorId: string,
): Promise<void> {
  // Saved with every permission that exists now: from here on, what the
  // office left unchecked stays unchecked.
  const published = {
    ...parse({ ...permissions, known: GRANTABLE_PERMISSIONS }),
    known: [...GRANTABLE_PERMISSIONS],
  };
  await database
    .insert(tenantContent)
    .values({
      tenantSlug,
      key: OFFICE_ROLE_PERMISSIONS_KEY,
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
    action: "office-settings.role-permissions",
    targetType: "tenant-content",
    targetId: OFFICE_ROLE_PERMISSIONS_KEY,
  });
}
