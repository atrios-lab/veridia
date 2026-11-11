"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/index.ts";
import { AccessHoursError, requestReleaseWith } from "@/lib/access-hours.ts";
import { getClosedHoursSession } from "@/lib/session.ts";

export type ReleaseRequestState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "error"; message: string };

/** From the closed screen: ask the Tabelião/Registrador for a release. */
export async function requestAccessRelease(
  _previous: ReleaseRequestState,
  formData: FormData,
): Promise<ReleaseRequestState> {
  const session = await getClosedHoursSession();
  if (!session) return { status: "error", message: "Sessão encerrada." };
  try {
    await requestReleaseWith(
      db,
      session.user.tenantSlug ?? "",
      { id: session.user.id, name: session.user.name },
      String(formData.get("reason") ?? ""),
    );
  } catch (error) {
    if (error instanceof AccessHoursError) {
      return { status: "error", message: error.message };
    }
    console.error("acesso.pedir-liberacao", error);
    return {
      status: "error",
      message: "Não foi possível enviar o pedido. Tente de novo.",
    };
  }
  revalidatePath("/admin", "layout");
  return { status: "sent" };
}
