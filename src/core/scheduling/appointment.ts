import { createHash, randomBytes } from "node:crypto";

/**
 * What an appointment is, once it exists: a state and a credential.
 *
 * There is no "requested" and no "proposed" here. The citizen who took a free
 * time has an appointment, not a request the office still has to answer,
 * which is the whole point of the change this module was written for.
 */

export const APPOINTMENT_STATUSES = [
  "booked",
  "attended",
  "cancelled",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/**
 * Two different questions, and they have different answers.
 *
 * "Does it still hold the time?": everything except a cancellation. An
 * appointment already attended has spent that hour of the counter's day; it
 * is not free. Treating "attended" as free reopened the slot the moment an
 * operator marked an early-arriving citizen as served, and the next person
 * could book an hour that was already used.
 *
 * "Can the office still act on it?": only one that is still booked. An
 * attended visit is not cancelled afterwards, and a cancelled one is not
 * attended.
 */
export const SLOT_HOLDING_STATUSES: readonly AppointmentStatus[] = [
  "booked",
  "attended",
];
export const ACTIONABLE_APPOINTMENT_STATUS: AppointmentStatus = "booked";

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  booked: "Agendado",
  attended: "Atendido",
  cancelled: "Cancelado",
};

/** What the panel and the e-mails call it. An unknown value never leaks a raw
 * column value onto a screen. */
export function appointmentStatusLabel(status: string): string {
  return STATUS_LABELS[status as AppointmentStatus] ?? "Agendado";
}

export function isAppointmentStatus(
  status: string,
): status is AppointmentStatus {
  return (APPOINTMENT_STATUSES as readonly string[]).includes(status);
}

/**
 * The citizen's only credential for their own appointment. It travels in the
 * confirmation e-mail and nowhere else: there is no protocol to quote and no
 * key to dictate over the phone, so unlike `access-key.ts` this one is never
 * read out loud and needs no human-friendly alphabet.
 *
 * randomBytes, not Math.random: it is the whole authorisation for cancelling
 * someone's appointment.
 */
export function generateCancelToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * SHA-256, unsalted, because the lookup has to find the row by hash and 256
 * bits of randomness leaves a rainbow table nothing to tabulate. Only the hash
 * is stored: a database dump must not hand out the power to cancel.
 */
export function hashCancelToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
