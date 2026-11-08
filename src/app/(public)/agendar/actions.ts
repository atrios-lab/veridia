"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { appointmentSchema } from "@/core/request/channels.ts";
import { looksLikeBot } from "@/core/request/form.ts";
import {
  AGENDA_NAMES,
  agendaRules,
  channelLabelsOn,
  isAgendaId,
  isRemoteMode,
  usesChannels,
} from "@/core/scheduling/agenda.ts";
import {
  generateCancelToken,
  hashCancelToken,
} from "@/core/scheduling/appointment.ts";
import { formatShortDate, officeHolidays } from "@/core/scheduling/calendar.ts";
import {
  attendanceNotice,
  CHECKLIST_CAVEAT,
  checklistFileHref,
  checklistFor,
  offeredAgendas,
  servicesOfAgenda,
} from "@/core/scheduling/services.ts";
import { isSlotFree, offeredDays } from "@/core/scheduling/slots.ts";
import { isSectionEnabled } from "@/core/tenant/gating.ts";
import {
  bookAppointment,
  getAgendaConfig,
  SlotTakenError,
  takenTimesByDay,
} from "@/lib/appointments.ts";
import {
  sendAppointmentBookedEmail,
  sendOfficeNewAppointmentEmail,
} from "@/lib/email/appointment.ts";
import { isRateLimited } from "@/lib/rate-limit.ts";
import { getTenant, officeNow } from "@/lib/tenant.ts";

export interface AppointmentSuccess {
  status: "success";
  date: string;
  slotTime: string;
  serviceLabel: string;
  /** "Atendimento com o tabelião", as the receipt names it. */
  agendaName: string;
  protocolNumber: string;
  /** What to bring, base items first, then the service's own. */
  checklist: string[];
  /** The service's own guidance, when it has one. */
  serviceNote?: string;
  /** The office's own sheet for the service, when it attached one. */
  checklistUrl?: string;
  /** Where to send a document ahead, with a doubt about it. */
  officeEmail?: string;
  /** "Chegue com 15 minutos de antecedência, às 08:45, ..." or, for the
   * notary's video and phone, how to be ready. */
  arrival: string;
  /** A video or phone appointment: nothing to bring to a counter. */
  remote?: boolean;
  caveat: string;
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
      agendaName: "",
      protocolNumber: "",
      checklist: [],
      arrival: "",
      caveat: "",
      email: String(formData.get("email") ?? ""),
      cancelToken: "",
    };
  }

  if (await isRateLimited(await headers())) {
    return fail(
      "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.",
    );
  }

  const office = await getAgendaConfig(tenant.slug);
  const agenda = formData.get("agenda");
  if (!isAgendaId(agenda) || !offeredAgendas(office).includes(agenda)) {
    return fail("Escolha a agenda do atendimento e tente de novo.");
  }
  const config = {
    ...agendaRules(office, agenda),
    holidays: officeHolidays(tenant),
  };
  const services = servicesOfAgenda(office, agenda);
  // The notary's channels depend on the day; the day is checked below, so
  // here only the shape of the answer is.
  const requestedDate = String(formData.get("date") ?? "");
  const modes = usesChannels(agenda)
    ? /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
      ? channelLabelsOn(office.agendas[agenda], requestedDate)
      : []
    : office.modes;
  const parsed = appointmentSchema({
    serviceIds: services.map((service) => service.id),
    modes,
  }).safeParse({
    date: formData.get("date") ?? "",
    slotTime: formData.get("slotTime") ?? "",
    citizenName: formData.get("citizenName") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    cpf: formData.get("cpf") ?? "",
    serviceId: formData.get("serviceId") ?? "",
    mode: formData.get("mode") ?? "",
    serviceDetails: formData.get("serviceDetails") ?? "",
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

  const service = services.find((item) => item.id === serviceId);
  const serviceLabel = service?.label ?? "";

  try {
    // Checked here as well as on the page: between rendering the times and
    // pressing the button, someone else may have taken this one. The database
    // is still the referee: this only turns the common case into a clear
    // message instead of a unique violation.
    const taken = await takenTimesByDay(
      tenant.slug,
      days[0],
      days[days.length - 1],
      agenda,
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
      agenda,
      serviceLabel,
      cancelTokenHash: hashCancelToken(cancelToken),
    });

    await sendAppointmentBookedEmail(tenant, appointment, cancelToken);
    // The office hears of it too, after the citizen's screen is answered.
    after(() => sendOfficeNewAppointmentEmail(tenant, appointment));

    return {
      status: "success",
      date,
      slotTime,
      serviceLabel,
      agendaName: AGENDA_NAMES[agenda].name,
      protocolNumber: appointment.protocolNumber ?? "",
      checklist: checklistFor(service ?? { bring: [] }),
      serviceNote: service?.note,
      officeEmail: tenant.contacts.email,
      checklistUrl: service?.hasOwnFile
        ? checklistFileHref(service.id)
        : undefined,
      arrival: attendanceNotice(slotTime, parsed.data.mode),
      remote: isRemoteMode(parsed.data.mode),
      caveat: CHECKLIST_CAVEAT,
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
