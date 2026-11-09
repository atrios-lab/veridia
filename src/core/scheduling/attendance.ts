import type { RequerimentoDocument } from "../request/requerimento.ts";
import {
  officeWithJurisdiction,
  officialName,
} from "../tenant/identification.ts";
import type { Tenant } from "../tenant/schema.ts";
import { type SlotTime, slotEndTime } from "./agenda.ts";
import { formatDate, type IsoDate } from "./calendar.ts";

/**
 * The attendance declaration ("Declaração de comparecimento"): the office
 * stating, under the public faith of the notary and the notary's staff, that
 * a citizen was at the counter on a given day and time. What people take to
 * an employer or a school to account for the hours.
 *
 * Not a certidão: a certidão reproduces what a book records, and no book
 * records a visit. Not a typed act either, so no fee table applies and it is
 * issued free. There is no statute of its own: it rests on the public faith
 * of the delegatário and the prepostos (Lei 8.935/1994, arts. 3º and 20) and
 * on their duty to serve the parties with efficiency (art. 30, II). Whether
 * it excuses an absence is for whoever receives it, which the text says.
 *
 * The visit's purpose is left out on purpose: "divórcio" or "inventário" on
 * a sheet handed to an employer would be more than the citizen chose to tell.
 */

export const ATTENDANCE_SIGNEE =
  "Tabelião / Substituto / Escrevente Autorizado";

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "6 de novembro de 2026", the way a declaration dates itself. */
export function writtenDate(date: IsoDate): string {
  return `${Number(date.slice(8, 10))} de ${MONTHS[Number(date.slice(5, 7)) - 1]} de ${date.slice(0, 4)}`;
}

function formatCpf(digits: string): string {
  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

export interface AttendanceData {
  citizenName: string;
  cpf: string | null;
  date: IsoDate;
  slotTime: SlotTime;
  protocolNumber: string | null;
  /** The day the declaration is issued, by the office's calendar. */
  issuedOn: IsoDate;
  /** The office's own site, by its domain ("cartorioielmomarinhorn.com"),
   * never the address the request happened to come through. */
  siteDomain: string;
  /** The code printed under the title, the last part of the address. */
  validationCode: string;
}

export function buildAttendanceDeclaration(
  tenant: Tenant,
  data: AttendanceData,
): RequerimentoDocument {
  const who = data.cpf
    ? `${data.citizenName}, inscrito(a) no CPF sob o nº ${formatCpf(data.cpf)}`
    : data.citizenName;
  const where = tenant.address ? `, situada em ${tenant.address}` : "";
  const protocol = data.protocolNumber
    ? `, agendado sob o protocolo ${data.protocolNumber}`
    : "";

  return {
    // The letterhead already reads "República Federativa do Brasil".
    eyebrow: "Atendimento na serventia",
    title: "Declaração de Comparecimento",
    subtitle: `${officialName(tenant)} · Código de validação ${data.validationCode}`,
    office: [
      officialName(tenant),
      tenant.subtitle,
      ...(tenant.address ? [tenant.address] : []),
    ],
    sections: [
      {
        heading: "Declaração",
        paragraphs: [
          `DECLARO, para os devidos fins, que ${who}, compareceu a esta serventia, ${officeWithJurisdiction(tenant)}${where}, no dia ${formatDate(data.date)}, no horário das ${data.slotTime} às ${slotEndTime(data.slotTime)}, para atendimento${protocol}.`,
          "Por ser verdade, firmo a presente declaração.",
        ],
      },
      {
        heading: "Fundamento e gratuidade",
        paragraphs: [
          "Declaração firmada com base na fé pública atribuída ao tabelião e aos seus prepostos (Lei nº 8.935/1994, arts. 3º e 20) e no dever de atender as partes com eficiência (art. 30, II).",
          "Emitida gratuitamente, sem cobrança de emolumentos, por não constituir ato notarial ou de registro previsto em tabela (Lei nº 10.169/2000).",
          "O aproveitamento desta declaração para justificar ausência ao trabalho, à escola ou a outra atividade depende da lei, do acordo ou convenção coletiva e das regras de quem a recebe.",
        ],
      },
      {
        heading: "Validação",
        paragraphs: [
          `Para conferir a autenticidade, leia o QR Code no alto desta folha, acesse o site da serventia (${data.siteDomain}) ou ligue para ${tenant.contacts.phone}, informando o código de validação ${data.validationCode}.`,
        ],
      },
    ],
    dateLine: `${tenant.location.city}/${tenant.location.state}, ${writtenDate(data.issuedOn)}.`,
    signee: ATTENDANCE_SIGNEE,
    signature: ["(assinatura e carimbo)"],
    footer: [
      officialName(tenant),
      "Declaração de comparecimento",
      data.protocolNumber,
      tenant.legalFooter,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}
