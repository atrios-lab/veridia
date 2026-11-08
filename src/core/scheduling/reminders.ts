import type { EmailText } from "../email/text.ts";
import { type SlotTime, slotEndTime } from "./agenda.ts";
import { addDays, formatLongDate, type IsoDate } from "./calendar.ts";
import {
  attendanceNotice,
  CHECKLIST_CAVEAT,
  documentsByEmailNotice,
} from "./services.ts";
import type { AgendaNow } from "./slots.ts";

/**
 * The reminders around an appointment: the citizen's, the day before, and the
 * office's, a summary of the next day plus a line for each new booking. Pure:
 * which ones are due and what they say. Claiming them so each goes out once,
 * and sending them, is `src/lib/appointment-reminders.ts`.
 */

/**
 * The day a reminder looks at: tomorrow, by the office's calendar. A visit
 * on Monday is reminded on Sunday; the job runs every day, so no weekday is
 * skipped.
 */
export function reminderDay(now: AgendaNow): IsoDate {
  return addDays(now.date, 1);
}

/** "quinta, 12/11/2026, às 09:00" */
function when(date: IsoDate, slotTime: SlotTime): string {
  return `${formatLongDate(date)}, das ${slotTime} às ${slotEndTime(slotTime)}`;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export interface ReminderFacts {
  officeName: string;
  officeEmail: string;
  citizenName: string;
  date: IsoDate;
  slotTime: SlotTime;
  serviceLabel: string;
  mode: string;
  agendaName: string;
  address: string;
  checklist: string[];
  protocolNumber: string | null;
}

/**
 * The citizen's reminder. No cancellation link: the token that cancels lives
 * only in the confirmation e-mail, and this one says where to find it. The
 * button leads to the protocol lookup, where the AGD number answers whether
 * the visit still holds.
 */
export function buildAppointmentReminderEmail(facts: ReminderFacts): EmailText {
  return {
    subject: `Lembrete: atendimento ${formatLongDate(facts.date)} às ${facts.slotTime}`,
    paragraphs: [
      `${firstName(facts.citizenName)}, lembramos do seu atendimento no ${facts.officeName}.`,
      `Quando: ${when(facts.date, facts.slotTime)}.`,
      `Serviço: ${facts.serviceLabel}. ${facts.agendaName}. Atendimento: ${facts.mode}.`,
      ...(facts.protocolNumber ? [`Protocolo: ${facts.protocolNumber}.`] : []),
      `Onde: ${facts.address}.`,
      attendanceNotice(facts.slotTime, facts.mode),
      "O que levar:",
      ...facts.checklist.map((item) => `• ${item}`),
      CHECKLIST_CAVEAT,
      ...(facts.officeEmail ? [documentsByEmailNotice(facts.officeEmail)] : []),
      "Não vai poder vir? Cancele pelo link do e-mail de confirmação, para liberar o horário para outra pessoa.",
    ],
    buttonLabel: "Consultar o agendamento",
    footnote: `${facts.officeName} · Lembrete automático do seu agendamento.`,
  };
}

export interface OfficeAppointmentLine {
  slotTime: SlotTime;
  citizenName: string;
  serviceLabel: string;
  mode: string;
  agendaName: string;
  phone: string;
  protocolNumber: string | null;
}

function line(item: OfficeAppointmentLine): string {
  return [
    item.slotTime,
    item.citizenName,
    item.serviceLabel,
    `${item.agendaName} (${item.mode})`,
    item.phone,
    item.protocolNumber,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** The office's reminder of the next day, one e-mail for all of it. */
export function buildOfficeDaySummaryEmail(
  officeName: string,
  date: IsoDate,
  items: OfficeAppointmentLine[],
): EmailText {
  const sorted = [...items].sort((a, b) =>
    a.slotTime.localeCompare(b.slotTime),
  );
  return {
    subject: `Agenda de ${formatLongDate(date)}: ${items.length} ${items.length === 1 ? "agendamento" : "agendamentos"}`,
    paragraphs: [
      `Lembrete dos atendimentos marcados para ${formatLongDate(date)}:`,
      ...sorted.map((item) => `• ${line(item)}`),
      "Os detalhes, o que cada cidadão informou e o comprovante estão na agenda do painel.",
    ],
    buttonLabel: "Abrir a agenda",
    footnote: `${officeName} · Lembrete automático enviado na véspera.`,
  };
}

/** The office told of a booking made on the site, the moment it happens. */
export function buildOfficeNewAppointmentEmail(
  officeName: string,
  date: IsoDate,
  item: OfficeAppointmentLine & { details: string | null },
): EmailText {
  return {
    subject: `Novo agendamento: ${item.citizenName}, ${formatLongDate(date)} às ${item.slotTime}`,
    paragraphs: [
      "Um cidadão agendou pelo site.",
      `Quando: ${when(date, item.slotTime)}.`,
      `Quem: ${item.citizenName} · ${item.phone}.`,
      `Serviço: ${item.serviceLabel}. ${item.agendaName}. Atendimento: ${item.mode}.`,
      ...(item.protocolNumber ? [`Protocolo: ${item.protocolNumber}.`] : []),
      ...(item.details ? [`O que informou: ${item.details}`] : []),
    ],
    buttonLabel: "Ver na agenda",
    footnote: `${officeName} · Aviso automático de agendamento pelo site.`,
  };
}

/** How long before the time the panel warns that someone is coming. */
export const ARRIVING_SOON_MINUTES = 15;
