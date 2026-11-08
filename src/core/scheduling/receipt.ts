import type {
  RequerimentoDocument,
  RequerimentoRow,
} from "../request/requerimento.ts";
import type { Tenant } from "../tenant/schema.ts";
import { formatOfficeDateTime } from "../time/office-time.ts";
import {
  AGENDA_NAMES,
  type AgendaId,
  isRemoteMode,
  slotEndTime,
} from "./agenda.ts";
import { formatLongDate, type IsoDate } from "./calendar.ts";
import {
  ARRIVAL_ADVANCE_MINUTES,
  arrivalTime,
  attendanceNotice,
  CHECKLIST_CAVEAT,
  checklistFor,
  type OfferedService,
} from "./services.ts";

/**
 * The appointment receipt ("Comprovante de agendamento"), on the office's
 * letterhead: what the citizen shows at the counter, with the list of what
 * to bring for the service they chose and the time to arrive. Content only,
 * like the requerimento next door: `src/lib/pdf.ts` places it on the page.
 */
export interface AppointmentReceiptData {
  protocolNumber: string | null;
  agenda: AgendaId;
  date: IsoDate;
  slotTime: string;
  citizenName: string;
  cpf: string | null;
  phone: string;
  email: string;
  mode: string;
  serviceDetails: string | null;
  /** The service as booked: the label from the record, the list from the
   * catalogue or the office's own services (empty when it is gone). */
  service: Pick<OfferedService, "label" | "bring" | "note"> & {
    checklist?: string[];
  };
  /** The office's own sheet for the service, as a full address. */
  checklistUrl?: string;
  createdAt: Date;
}

function formatCpf(digits: string): string {
  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

export function buildAppointmentReceipt(
  tenant: Tenant,
  data: AppointmentReceiptData,
): RequerimentoDocument {
  const when: RequerimentoRow[] = [
    { label: "Data", value: formatLongDate(data.date) },
    {
      label: "Horário",
      value: `${data.slotTime} às ${slotEndTime(data.slotTime)}`,
    },
    // Nobody arrives anywhere for a call: the row only means something at
    // the counter.
    ...(isRemoteMode(data.mode)
      ? []
      : [
          {
            label: "Chegada",
            value: `Até ${arrivalTime(data.slotTime)} (${ARRIVAL_ADVANCE_MINUTES} minutos antes)`,
          },
        ]),
    { label: "Agenda", value: AGENDA_NAMES[data.agenda].name },
    { label: "Serviço", value: data.service.label },
    { label: "Atendimento", value: data.mode },
  ];

  const person: RequerimentoRow[] = [
    { label: "Nome", value: data.citizenName },
  ];
  if (data.cpf) person.push({ label: "CPF", value: formatCpf(data.cpf) });
  const contact = [data.phone, data.email].filter(Boolean).join(" · ");
  if (contact) person.push({ label: "Contato", value: contact });

  // The arrival comes right under the time, before the papers: it is the one
  // instruction that decides whether the visit works, and it stays on the
  // first page however long the service's list is.
  const sections: RequerimentoDocument["sections"] = [
    { heading: "Seu atendimento", rows: when },
    {
      heading: "Antes de vir",
      paragraphs: [
        isRemoteMode(data.mode)
          ? `${attendanceNotice(data.slotTime, data.mode)} Não vai poder atender? Cancele pelo link do e-mail de confirmação, para liberar o horário para outra pessoa.`
          : `${attendanceNotice(data.slotTime, data.mode)} Apresente este comprovante na recepção, impresso ou no celular. Não vai poder vir? Cancele pelo link do e-mail de confirmação, para liberar o horário para outra pessoa.`,
      ],
    },
    { heading: "Quem vai ser atendido", rows: person },
  ];
  if (data.serviceDetails) {
    sections.push({
      heading: "O que você informou",
      paragraphs: [data.serviceDetails],
    });
  }
  sections.push({
    heading: isRemoteMode(data.mode) ? "O que ter em mãos" : "O que trazer",
    paragraphs: [
      ...checklistFor(data.service).map((item) => `[  ] ${item}`),
      ...(data.service.note ? [data.service.note] : []),
      ...(data.checklistUrl
        ? [
            `O cartório tem uma lista própria para este serviço: ${data.checklistUrl}`,
          ]
        : []),
      CHECKLIST_CAVEAT,
    ],
  });

  const protocol = data.protocolNumber
    ? `Protocolo ${data.protocolNumber}`
    : "";
  return {
    eyebrow: AGENDA_NAMES[data.agenda].name,
    title: "Comprovante de agendamento",
    subtitle: [protocol, `agendado em ${formatOfficeDateTime(data.createdAt)}`]
      .filter(Boolean)
      .join(" · "),
    office: [
      tenant.name,
      tenant.subtitle,
      ...(tenant.address ? [tenant.address] : []),
      [tenant.contacts.phone, tenant.contacts.email]
        .filter(Boolean)
        .join(" · "),
    ],
    sections,
    signature: [],
    footer: `${tenant.name} · ${protocol || "Agendamento"} · ${tenant.legalFooter}`,
  };
}
