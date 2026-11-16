"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import { COURSES_TENANT_SLUG } from "@/core/tenant/courses-tenant.ts";
import { DEMO_RESET_CONFIRMATION } from "@/core/tenant/demo-office.ts";
import { db } from "@/db/index.ts";
import { DemoResetRefused, resetDemoOfficeWith } from "@/lib/demo-reset.ts";
import { seedDemoOfficeWith } from "@/lib/demo-seed.ts";
import { getSession } from "@/lib/session.ts";
import { today } from "@/lib/tenant.ts";
import { listTenantStoredFiles } from "@/lib/uploads.ts";
import { COHORTS_PATH } from "./paths.ts";

// ⚠️ Deletes data: the cleaning of the demonstration office (see
// lib/demo-reset.ts). The platform account only, and only after typing the
// confirmation word: a click alone never wipes what the participants did.

export type DemoResetState =
  | { status: "idle" }
  | { status: "done"; rows: number; files: number }
  | { status: "error"; message: string };

export async function resetDemoOfficeAction(
  _previous: DemoResetState,
  formData: FormData,
): Promise<DemoResetState> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "cohorts.manage", session.user.permissions)
  ) {
    return {
      status: "error",
      message: "Você não tem permissão para limpar o cartório de demonstração.",
    };
  }
  const typed = String(formData.get("confirmation") ?? "").trim();
  if (typed !== DEMO_RESET_CONFIRMATION) {
    return {
      status: "error",
      message: `Digite ${DEMO_RESET_CONFIRMATION} para confirmar. Nada foi apagado.`,
    };
  }
  const actorId = session.user.id;
  try {
    const result = await resetDemoOfficeWith(db, COURSES_TENANT_SLUG, actorId, {
      listFiles: listTenantStoredFiles,
      seed: (database, tenant) =>
        seedDemoOfficeWith(database, tenant, actorId, today()),
    });
    revalidatePath(COHORTS_PATH);
    return {
      status: "done",
      rows: Object.values(result.rows).reduce((sum, n) => sum + n, 0),
      files: result.files,
    };
  } catch (error) {
    if (error instanceof DemoResetRefused) {
      return { status: "error", message: error.message };
    }
    console.error("demo.reset", error);
    return {
      status: "error",
      message:
        "A limpeza não terminou. Se os registros já tinham sido apagados, rode o seed do tenant de cursos.",
    };
  }
}
