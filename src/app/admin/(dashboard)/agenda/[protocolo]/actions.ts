"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import {
  proposeAppointmentSlot,
  updateRecordStatus,
} from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export type ActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

const NO_PERMISSION = "Você não tem permissão para alterar este pedido.";
const GENERIC_ERROR =
  "Não foi possível salvar agora. Tente novamente em instantes.";

/** Every action here re-checks on the server, same discipline as
 * `/admin/pedidos`: hiding the link and the page 404-ing are a courtesy. */
async function authorize() {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "channels.manage")) {
    return null;
  }
  return session;
}

function revalidateAdmin(): void {
  revalidatePath("/admin", "layout");
}

export async function confirmAppointment(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const requestId = String(formData.get("requestId") ?? "");
  const tenant = await getTenant();
  try {
    await updateRecordStatus(
      tenant.slug,
      requestId,
      "appointment",
      "confirmed",
      "appointment.confirm",
      session.user.id,
    );
  } catch (error) {
    console.error("agenda.confirm", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success" };
}

export async function cancelAppointment(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const requestId = String(formData.get("requestId") ?? "");
  const tenant = await getTenant();
  try {
    await updateRecordStatus(
      tenant.slug,
      requestId,
      "appointment",
      "cancelled",
      "appointment.cancel",
      session.user.id,
    );
  } catch (error) {
    console.error("agenda.cancel", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success" };
}

export async function markAppointmentAttended(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const requestId = String(formData.get("requestId") ?? "");
  const tenant = await getTenant();
  try {
    await updateRecordStatus(
      tenant.slug,
      requestId,
      "appointment",
      "done",
      "appointment.attend",
      session.user.id,
    );
  } catch (error) {
    console.error("agenda.attend", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success" };
}

export async function proposeOtherSlot(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const requestId = String(formData.get("requestId") ?? "");
  const date = String(formData.get("date") ?? "");
  const slotHour = Number(formData.get("slotHour") ?? Number.NaN);
  if (!date || Number.isNaN(slotHour)) {
    return { status: "error", message: "Escolha um dia e uma faixa livre." };
  }

  const tenant = await getTenant();
  try {
    await proposeAppointmentSlot(
      tenant.slug,
      requestId,
      date,
      slotHour,
      session.user.id,
    );
  } catch (error) {
    console.error("agenda.propose", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success" };
}
