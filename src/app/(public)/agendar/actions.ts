"use server";

import { headers } from "next/headers";
import { appointmentSchema } from "@/core/request/channels.ts";
import { looksLikeBot } from "@/core/request/form.ts";
import {
  generateCancelToken,
  hashCancelToken,
} from "@/core/scheduling/appointment.ts";
import { formatShortDate } from "@/core/scheduling/calendar.ts";
import { isSlotFree, offeredDays } from "@/core/scheduling/slots.ts";
import { isSectionEnabled } from "@/core/tenant/gating.ts";
import {
  bookAppointment,
  getAgendaConfig,
  SlotTakenError,
  takenTimesByDay,
} from "@/lib/appointments.ts";
import { sendAppointmentBookedEmail } from "@/lib/email/appointment.ts";
import { isRateLimited } from "@/lib/rate-limit.ts";
import { getTenant, officeNow } from "@/lib/tenant.ts";

export interface AppointmentSuccess {
  status: "success";
  date: string;
  slotTime: string;
  serviceLabel: string;
  /** Where the confirmation went, echoed back so a typo is visible at once. */
  email: string;
  /** Carries the calendar download on the confirmation screen, by POST. */
  cancelToken: string;
}

export type AppointmentState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> }
  | AppointmentSuccess;

const GENERIC_ERROR =
  "Não foi possível agendar agora. Tente novamente em instantes.";

function fail(
  message: string,
  fieldErrors: Record<string, string> = {},
): AppointmentState {
  return { status: "error", message, fieldErrors };
}

export async function submitAppointment(
  _previous: AppointmentState,
  formData: FormData,
): Promise<AppointmentState> {
  const tenant = await getTenant();
  if (!isSectionEnabled(tenant, "agendamento")) return fail(GENERIC_ERROR);

  /*
   * The invisible field, checked before anything is written. A script that
   * filled it gets the screen a person gets, so the run reads as successful
   * and nothing is booked. No CAPTCHA: asking a citizen to solve a puzzle to
   * book a counter visit is a toll on the people least able to pay it.
   */
  if (looksLikeBot(formData.get("website"))) {
    return {
      status: "success",
      date: String(formData.get("date") ?? ""),
      slotTime: String(formData.get("slotTime") ?? ""),
      serviceLabel: "",
      email: String(formData.get("email") ?? ""),
      cancelToken: "",
    };
  }

  if (await isRateLimited(await headers())) {
    return fail(
      "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.",
    );
  }

  const config = await getAgendaConfig(tenant.slug);
  const parsed = appointmentSchema({
    serviceIds: config.services.map((service) => service.id),
    modes: config.modes,
  }).safeParse({
    date: formData.get("date") ?? "",
    slotTime: formData.get("slotTime") ?? "",
    citizenName: formData.get("citizenName") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    cpf: formData.get("cpf") ?? "",
    serviceId: formData.get("serviceId") ?? "",
    mode: formData.get("mode") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return fail("Confira os campos destacados.", fieldErrors);
  }

  const { date, slotTime, serviceId } = parsed.data;
  const now = officeNow();
  const days = offeredDays(config, now.date);

  // The day has to be one the office actually receives on, and not one already
  // past: a form left open overnight must not book yesterday.
  if (!days.includes(date)) {
    return fail("Escolha um dos dias oferecidos para atendimento.", {
      date: "Este dia não está disponível para atendimento.",
    });
  }

  const serviceLabel =
    config.services.find((service) => service.id === serviceId)?.label ?? "";

  try {
    // Checked here as well as on the page: between rendering the times and
    // pressing the button, someone else may have taken this one. The database
    // is still the referee — this only turns the common case into a clear
    // message instead of a unique violation.
    const taken = await takenTimesByDay(
      tenant.slug,
      days[0],
      days[days.length - 1],
    );
    if (
      !isSlotFree(
        config,
        date,
        slotTime,
        taken.get(date) ?? new Set<string>(),
        now,
      )
    ) {
      return slotGone(date, days);
    }

    const cancelToken = generateCancelToken();
    const appointment = await bookAppointment(tenant.slug, {
      ...parsed.data,
      serviceLabel,
      cancelTokenHash: hashCancelToken(cancelToken),
    });

    await sendAppointmentBookedEmail(tenant, appointment, cancelToken);

    return {
      status: "success",
      date,
      slotTime,
      serviceLabel,
      email: appointment.email,
      cancelToken,
    };
  } catch (error) {
    // The race the index caught: someone booked this exact time in the
    // moment between the check above and the insert.
    if (error instanceof SlotTakenError) {
      return fail(
        "Este horário acabou de ser preenchido. Escolha outro horário livre.",
        { slotTime: "Horário ocupado. Escolha outro." },
      );
    }
    console.error("agendar.submit", error);
    return fail(GENERIC_ERROR);
  }
}

/** The chosen time is gone: say so, and name a way out rather than a dead end. */
function slotGone(date: string, days: string[]): AppointmentState {
  const next = days.find((day) => day > date);
  return fail(
    next
      ? `Este horário fechou enquanto você preenchia. Veja os horários de ${formatShortDate(next)}.`
      : "Este horário fechou enquanto você preenchia. Fale com a serventia para encontrar outro.",
    { slotTime: "Horário ocupado. Escolha outro." },
  );
}
