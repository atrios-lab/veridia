import "server-only";
import { slotEndTime } from "@/core/scheduling/agenda.ts";
import {
  buildAgendaDayClosedEmail,
  buildAppointmentBookedEmail,
  buildAppointmentCancelledEmail,
} from "@/core/scheduling/emails.ts";
import { buildCalendarEvent } from "@/core/scheduling/ics.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import type { Appointment } from "@/lib/appointments.ts";
import { OFFICE_TIME_ZONE } from "@/lib/tenant.ts";
import { renderEmailCardHtml, renderEmailCardText } from "./render.ts";
import { sendEmail } from "./send.ts";

/**
 * The three letters the agenda sends. Unlike the protocol notices next door,
 * these carry the appointment itself: there is nothing behind a key to
 * protect, and the whole point is that the citizen can read when to show up
 * without opening anything.
 *
 * Every one of them is best effort: an appointment that is booked stays
 * booked, and a day the office closed stays closed, whatever the mail
 * provider is doing. Failures are logged, never thrown at the caller, because
 * there is nothing useful the counter could do with the exception.
 */

function identity(tenant: Tenant) {
  const host = tenant.hosts[0];
  return {
    name: tenant.name,
    subtitle: tenant.subtitle,
    sealUrl: host ? `https://${host}${tenant.logos.seal.light}` : "",
  };
}

function baseUrl(tenant: Tenant): string {
  const host = tenant.hosts[0];
  return host ? `https://${host}` : "";
}

function facts(tenant: Tenant, appointment: Appointment) {
  return {
    officeName: tenant.name,
    citizenName: appointment.citizenName,
    date: appointment.date,
    slotTime: appointment.slotTime,
    serviceLabel: appointment.serviceLabel,
    mode: appointment.mode,
    // Offices registered before the address field existed have none; the
    // citizen still knows where the counter is, and a line saying "endereço
    // não informado" would be worse than the office's own name.
    address: tenant.address ?? tenant.name,
  };
}

/** The appointment as a calendar file, attached to the confirmation so it
 * lands in the citizen's own calendar with one tap. */
function calendarFile(tenant: Tenant, appointment: Appointment): string {
  return buildCalendarEvent(
    {
      uid: `agendamento-${appointment.id}@${tenant.slug}`,
      date: appointment.date,
      startTime: appointment.slotTime,
      endTime: slotEndTime(appointment.slotTime),
      title: `Atendimento · ${tenant.name}`,
      description: `${appointment.serviceLabel} · ${appointment.mode}`,
      location: tenant.address ?? tenant.name,
      stamp: new Date(),
    },
    OFFICE_TIME_ZONE,
  );
}

/**
 * The confirmation, with the cancellation link as its button and the calendar
 * file attached. The token travels here and nowhere else: this e-mail is the
 * citizen's only credential over their own appointment.
 */
export async function sendAppointmentBookedEmail(
  tenant: Tenant,
  appointment: Appointment,
  cancelToken: string,
): Promise<void> {
  const text = buildAppointmentBookedEmail(facts(tenant, appointment));
  const cancelUrl = `${baseUrl(tenant)}/agendar/cancelar?token=${encodeURIComponent(cancelToken)}`;
  try {
    await sendEmail({
      to: appointment.email,
      fromName: tenant.name,
      subject: text.subject,
      html: renderEmailCardHtml(text, identity(tenant), cancelUrl),
      text: renderEmailCardText(text, cancelUrl),
      attachments: [
        {
          filename: "agendamento.ics",
          content: calendarFile(tenant, appointment),
        },
      ],
    });
  } catch (error) {
    console.error("appointment.email.booked", appointment.id, error);
  }
}

/**
 * The office calling an appointment off, one or as part of a closed day. The
 * button leads back to the agenda: the citizen whose morning was just undone
 * should be one tap from fixing it, not hunting for the page again.
 */
export async function sendAppointmentCancelledEmail(
  tenant: Tenant,
  appointment: Appointment,
  reason: string,
  scope: "one" | "day",
): Promise<void> {
  const build =
    scope === "day"
      ? buildAgendaDayClosedEmail
      : buildAppointmentCancelledEmail;
  const text = build({ ...facts(tenant, appointment), reason });
  const agendaUrl = `${baseUrl(tenant)}/agendar`;
  try {
    await sendEmail({
      to: appointment.email,
      fromName: tenant.name,
      subject: text.subject,
      html: renderEmailCardHtml(text, identity(tenant), agendaUrl),
      text: renderEmailCardText(text, agendaUrl),
    });
  } catch (error) {
    console.error("appointment.email.cancelled", appointment.id, error);
  }
}

/**
 * Writes to everyone whose appointment a closed day just cancelled. Sent one
 * after another rather than through a queue: a day holds a handful of
 * appointments, and each `send` already swallows its own failure, so one
 * unreachable mailbox must not cost the others their warning.
 */
export async function sendAgendaDayClosedEmails(
  tenant: Tenant,
  cancelled: Appointment[],
  reason: string,
): Promise<void> {
  for (const appointment of cancelled) {
    await sendAppointmentCancelledEmail(tenant, appointment, reason, "day");
  }
}
