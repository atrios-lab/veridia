"use server";

import { cancelAppointment, findByCancelToken } from "@/lib/appointments.ts";
import { getTenant } from "@/lib/tenant.ts";

export type CancelState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "cancelled" };

/**
 * The citizen giving up their own time, from the link in the confirmation
 * e-mail. No reason is asked for: nobody owes the counter an explanation for
 * not coming, and a required field here would only produce "não posso".
 *
 * A token that matches nothing gets the same answer as one already used —
 * the link clicked twice must not report a different outcome than a link
 * someone else guessed.
 */
export async function cancelByToken(
  _previous: CancelState,
  formData: FormData,
): Promise<CancelState> {
  const token = String(formData.get("token") ?? "");
  const tenant = await getTenant();

  try {
    const appointment = token
      ? await findByCancelToken(tenant.slug, token)
      : undefined;
    if (!appointment) {
      return {
        status: "error",
        message:
          "Este link não vale mais. O agendamento já foi cancelado ou atendido.",
      };
    }
    await cancelAppointment(tenant.slug, appointment.id);
    return { status: "cancelled" };
  } catch (error) {
    console.error("agendar.cancelar", error);
    return {
      status: "error",
      message:
        "Não foi possível cancelar agora. Tente novamente em instantes ou fale com a serventia.",
    };
  }
}
