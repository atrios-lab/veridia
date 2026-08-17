import type { EmailText } from "../email/text.ts";
import { type SlotTime, slotEndTime } from "./agenda.ts";
import { formatLongDate, type IsoDate } from "./calendar.ts";

/**
 * What the office writes to a citizen about their appointment.
 *
 * There is no protocol to quote and no access key to guard, so unlike the
 * notices in `src/lib/email/service-request.ts` these carry the whole thing:
 * the day, the time and what it is for. The appointment IS the content: an
 * e-mail that made someone log in to find out when to show up would be a
 * worse version of a paper card.
 */

export interface AppointmentEmailFacts {
  officeName: string;
  citizenName: string;
  date: IsoDate;
  slotTime: SlotTime;
  serviceLabel: string;
  mode: string;
  address: string;
}

/** "quinta, 06/08/2026, das 08:30 às 09:30" */
function when(date: IsoDate, slotTime: SlotTime): string {
  return `${formatLongDate(date)}, das ${slotTime} às ${slotEndTime(slotTime)}`;
}

/** The first name, for the greeting. A full legal name in a salutation reads
 * like a summons, which is not what booking a counter visit is. */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/**
 * The confirmation. It is already booked when this goes out, and nothing here
 * asks the citizen to wait for an answer, because there is no answer coming.
 */
export function buildAppointmentBookedEmail(
  facts: AppointmentEmailFacts,
): EmailText {
  return {
    subject: `Agendamento confirmado · ${formatLongDate(facts.date)} às ${facts.slotTime}`,
    paragraphs: [
      `${firstName(facts.citizenName)}, seu atendimento está agendado.`,
      `Quando: ${when(facts.date, facts.slotTime)}.`,
      `Serviço: ${facts.serviceLabel}. Atendimento: ${facts.mode}.`,
      `Onde: ${facts.address}.`,
      "Leve um documento com foto. Se for tratar de assunto de outra pessoa, leve procuração.",
      "Não vai poder vir? Cancele pelo botão abaixo para liberar o horário para outra pessoa.",
    ],
    buttonLabel: "Cancelar este agendamento",
    footnote: `${facts.officeName} · Este e-mail é o comprovante do seu agendamento. Guarde-o: o link acima é a única forma de cancelar pela internet.`,
  };
}

/**
 * The office calling one appointment off. The reason is the office's own
 * words, quoted whole: a cancellation without a why is what makes a citizen
 * show up anyway.
 */
export function buildAppointmentCancelledEmail(
  facts: AppointmentEmailFacts & { reason: string },
): EmailText {
  return {
    subject: `Agendamento cancelado · ${formatLongDate(facts.date)} às ${facts.slotTime}`,
    paragraphs: [
      `${firstName(facts.citizenName)}, a serventia precisou cancelar o seu atendimento.`,
      `Estava marcado para ${when(facts.date, facts.slotTime)}, para ${facts.serviceLabel}.`,
      `Motivo informado pela serventia: ${facts.reason}`,
      "Você pode escolher um novo horário agora, pelo botão abaixo.",
    ],
    buttonLabel: "Escolher outro horário",
    footnote: `${facts.officeName} · Se precisar resolver com urgência, procure a serventia pelo telefone.`,
  };
}

/**
 * The whole day called off. Same facts as a single cancellation and a
 * different first line: the citizen has to understand it was not about them,
 * or the next thing they do is call to ask what they did wrong.
 */
export function buildAgendaDayClosedEmail(
  facts: AppointmentEmailFacts & { reason: string },
): EmailText {
  return {
    subject: `Atendimento cancelado · ${formatLongDate(facts.date)}`,
    paragraphs: [
      `${firstName(facts.citizenName)}, a serventia não vai atender em ${formatLongDate(facts.date)} e todos os agendamentos do dia foram cancelados.`,
      `O seu era ${when(facts.date, facts.slotTime)}, para ${facts.serviceLabel}.`,
      `Motivo informado pela serventia: ${facts.reason}`,
      "Escolha um novo dia e horário pelo botão abaixo.",
    ],
    buttonLabel: "Escolher outro horário",
    footnote: `${facts.officeName} · Se precisar resolver com urgência, procure a serventia pelo telefone.`,
  };
}
