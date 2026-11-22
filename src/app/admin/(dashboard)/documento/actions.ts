"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import {
  markRequestFilesSavedWith,
  undoRequestFilesSavedWith,
} from "@/lib/request-files-due.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

/** Either permission, like the file route: the same files hang off a
 * request (requests) or an LGPD or ombudsman protocol (channels). */
async function authorize() {
  const session = await getSession();
  const role = session?.user.role ?? "";
  const granted = session?.user.permissions;
  if (
    !session ||
    !(
      can(role, "requests.manage", granted) ||
      can(role, "channels.manage", granted)
    )
  ) {
    return undefined;
  }
  return { session, tenant: await getTenant() };
}

/** "Já salvei": the daily reminder stops for this protocol. */
export async function markFilesSavedAction(formData: FormData): Promise<void> {
  const auth = await authorize();
  const requestId = String(formData.get("requestId") ?? "");
  if (!auth || !requestId) return;
  await markRequestFilesSavedWith(
    db,
    auth.tenant.slug,
    requestId,
    auth.session.user.id,
    "button",
  );
  revalidatePath("/admin", "layout");
}

/** Undoes "Já salvei": the reminder comes back until the files go. */
export async function undoFilesSavedAction(formData: FormData): Promise<void> {
  const auth = await authorize();
  const requestId = String(formData.get("requestId") ?? "");
  if (!auth || !requestId) return;
  await undoRequestFilesSavedWith(
    db,
    auth.tenant.slug,
    requestId,
    auth.session.user.id,
  );
  revalidatePath("/admin", "layout");
}
