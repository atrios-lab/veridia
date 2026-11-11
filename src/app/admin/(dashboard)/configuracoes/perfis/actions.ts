"use server";

import { revalidatePath } from "next/cache";
import { can, PANEL_ROLES } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import {
  type RolePermissions,
  saveRolePermissionsWith,
} from "@/lib/role-permissions.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export type RolesState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message: string };

/** What each position may do: the Tabelião/Registrador's decision. */
export async function saveRoles(
  _previous: RolesState,
  formData: FormData,
): Promise<RolesState> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "user.manage", session.user.permissions)
  ) {
    return {
      status: "error",
      message: "Só o Tabelião/Registrador define as permissões.",
    };
  }
  const tenant = await getTenant();
  const chosen: RolePermissions = {};
  for (const role of PANEL_ROLES) {
    if (role === "admin") continue;
    chosen[role] = formData.getAll(role).map(String);
  }
  await saveRolePermissionsWith(db, tenant.slug, chosen, session.user.id);
  revalidatePath("/admin", "layout");
  return { status: "saved" };
}
