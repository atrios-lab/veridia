"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import {
  AccessHoursError,
  decideReleaseWith,
  type ReleaseDecision,
  saveAccessWindowWith,
} from "@/lib/access-hours.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export type HoursState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

async function holder() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "user.manage", session.user.permissions)
  ) {
    return undefined;
  }
  return { session, tenant: await getTenant() };
}

export async function saveAccessWindow(
  _previous: HoursState,
  formData: FormData,
): Promise<HoursState> {
  const access = await holder();
  if (!access) return { status: "error", message: "Sem permissão." };
  try {
    await saveAccessWindowWith(
      db,
      access.tenant.slug,
      {
        enabled: formData.get("enabled") === "on",
        start: String(formData.get("start") ?? ""),
        end: String(formData.get("end") ?? ""),
      },
      access.session.user.id,
    );
  } catch (error) {
    if (error instanceof AccessHoursError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
  revalidatePath("/admin", "layout");
  return { status: "saved", message: "Horário salvo." };
}

const DECISIONS: ReleaseDecision[] = ["hoje", "sempre", "recusar", "retirar"];

export async function decideRelease(formData: FormData): Promise<void> {
  const access = await holder();
  if (!access) return;
  const decision = String(formData.get("decision") ?? "") as ReleaseDecision;
  if (!DECISIONS.includes(decision)) return;
  await decideReleaseWith(
    db,
    access.tenant.slug,
    String(formData.get("userId") ?? ""),
    decision,
    access.session.user.id,
  );
  revalidatePath("/admin", "layout");
}
