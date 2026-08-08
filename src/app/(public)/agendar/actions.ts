"use server";

import { headers } from "next/headers";
import { generateAccessKey, hashAccessKey } from "@/core/request/access-key.ts";
import { appointmentSchema } from "@/core/request/channels.ts";
import { looksLikeBot } from "@/core/request/form.ts";
import { parseDetails } from "@/core/request/kinds.ts";
import { formatProtocolNumber } from "@/core/request/protocol.ts";
import {
  formatShortDate,
  isBusinessDay,
  nextBusinessDays,
} from "@/core/scheduling/calendar.ts";
import {
  isSlotFree,
  nextDayWithSlot,
  OFFERED_DAYS,
} from "@/core/scheduling/slots.ts";
import { isSectionEnabled } from "@/core/tenant/gating.ts";
import { isRateLimited } from "@/lib/rate-limit.ts";
import { appointmentOccupancy, createRecord } from "@/lib/service-request.ts";
import { getTenant, today } from "@/lib/tenant.ts";

export interface AppointmentSuccess {
  status: "success";
  protocolNumber: string;
  /** In the clear exactly once: never stored, never sent again. */
  accessKey: string;
  date: string;
  slotHour: number;
}

export type AppointmentState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> }
  | AppointmentSuccess;

const GENERIC_ERROR =
  "Não foi possível enviar o pedido agora. Tente novamente em instantes.";

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
   * and nothing is filed. No CAPTCHA: asking a citizen to solve a puzzle to
   * book a counter visit is a toll on the people least able to pay it.
   */
  if (looksLikeBot(formData.get("website"))) {
    return {
      status: "success",
      protocolNumber: formatProtocolNumber(
        "AGD",
        new Date().getFullYear(),
        999_999,
      ),
      accessKey: generateAccessKey(),
      date: String(formData.get("date") ?? ""),
      slotHour: Number(formData.get("slotHour") ?? 0),
    };
  }

  if (await isRateLimited(await headers())) {
    return fail(
      "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.",
    );
  }

  const parsed = appointmentSchema(tenant.scheduling).safeParse({
    date: formData.get("date") ?? "",
    slotHour: formData.get("slotHour") ?? "",
    applicantName: formData.get("applicantName") ?? "",
    contact: formData.get("contact") ?? "",
    subject: formData.get("subject") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return fail("Confira os campos destacados.", fieldErrors);
  }

  const { date, slotHour, applicantName, contact, subject } = parsed.data;
  const from = today();

  // The day has to be one the office actually opens, and not one already
  // past: a form left open overnight must not file yesterday.
  const offered = nextBusinessDays(from, OFFERED_DAYS);
  if (!isBusinessDay(date) || !offered.includes(date)) {
    return fail("Escolha um dos dias oferecidos para atendimento.", {
      date: "Este dia não está disponível para atendimento.",
    });
  }

  try {
    // Checked again here, not only on the page: between rendering the bands
    // and pressing the button, someone else may have taken the last one.
    const occupancy = await appointmentOccupancy(
      tenant.slug,
      offered[0],
      offered[offered.length - 1],
    );
    if (!isSlotFree(tenant.scheduling, occupancy.get(date) ?? {}, slotHour)) {
      const next = nextDayWithSlot(tenant.scheduling, offered, occupancy, date);
      return fail(
        next
          ? `Esta faixa fechou enquanto você preenchia. O próximo dia com vaga é ${formatShortDate(next)}.`
          : "Esta faixa fechou enquanto você preenchia. Fale com a serventia para encontrar um horário.",
        { slotHour: "Faixa ocupada. Escolha outra." },
      );
    }

    const accessKey = generateAccessKey();
    const { protocolNumber } = await createRecord(tenant, "appointment", {
      applicantName,
      contact,
      accessKeyHash: hashAccessKey(accessKey),
      description: subject,
      details: parseDetails("appointment", { date, slotHour, subject }),
      status: "requested",
    });

    return { status: "success", protocolNumber, accessKey, date, slotHour };
  } catch (error) {
    console.error("agendar.submit", error);
    return fail(GENERIC_ERROR);
  }
}
