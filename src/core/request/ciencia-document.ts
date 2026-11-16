import { writtenDate } from "../scheduling/attendance.ts";
import type { IsoDate } from "../scheduling/calendar.ts";
import { officialName } from "../tenant/identification.ts";
import type { Tenant } from "../tenant/schema.ts";
import type { RequerimentoDocument } from "./requerimento.ts";

/**
 * The comprovante de ciência (decision of 16/11/2026): what the office put
 * on a request and when the citizen saw it on the consult, and when they
 * opened or downloaded each document. It certifies the delivery, under the
 * office's letterhead, to sign digitally or print.
 */

export interface CienciaItem {
  /** "Exigência registrada em 15/11/2026: …", "Documento “Nota …”". */
  label: string;
  /** "16/11/2026, 10:32", or absent when not seen yet. */
  viewed?: string;
  /** Documents only: when first opened or downloaded. */
  opened?: string;
  document: boolean;
  /** The address of the first time, as evidence. */
  ip?: string;
}

const SHORT = 160;

/** An exigência's text, short enough for one line of the comprovante. */
export function shortText(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > SHORT ? `${flat.slice(0, SHORT - 1).trimEnd()}…` : flat;
}

/** One line of the comprovante, in plain words. */
export function cienciaLine(item: CienciaItem): string {
  const parts: string[] = [];
  parts.push(
    item.viewed
      ? `visto pelo requerente em ${item.viewed}`
      : "ainda não visto pelo requerente",
  );
  if (item.document) {
    parts.push(
      item.opened ? `aberto ou baixado em ${item.opened}` : "ainda não aberto",
    );
  }
  const where = item.ip ? ` (acesso a partir do endereço ${item.ip})` : "";
  return `• ${item.label}: ${parts.join("; ")}${where}.`;
}

export function buildCienciaDocument(
  tenant: Tenant,
  input: {
    protocolNumber: string;
    actName: string;
    applicantName?: string;
    issuedOn: IsoDate;
    items: readonly CienciaItem[];
    signee: string;
  },
): RequerimentoDocument {
  const who = input.applicantName
    ? `o(a) requerente ${input.applicantName}`
    : "o(a) requerente";
  return {
    eyebrow: "Atendimento online",
    title: "Comprovante de ciência",
    subtitle: `Protocolo ${input.protocolNumber} · ${input.actName}`,
    office: [officialName(tenant), tenant.subtitle],
    sections: [
      {
        heading: "Certificação",
        paragraphs: [
          `Certifico, com base nos registros automáticos da plataforma de atendimento desta serventia, que ${who}, ao consultar o protocolo ${input.protocolNumber} com a sua chave de acesso, tomou ciência do que segue, nas datas e horários indicados.`,
        ],
      },
      {
        heading: "Registros",
        paragraphs: input.items.length
          ? input.items.map(cienciaLine)
          : ["• Nada foi disponibilizado ao requerente neste protocolo."],
      },
      {
        heading: "Observações",
        paragraphs: [
          "A consulta do protocolo só se abre com o número do protocolo e a chave de acesso, entregue ao requerente. O requerente é avisado na própria consulta de que a ciência fica registrada.",
          "Vale a primeira vez de cada registro. Os horários seguem o fuso horário da serventia. As consultas feitas por usuários conectados ao painel da serventia não são registradas.",
        ],
      },
    ],
    dateLine: `${tenant.location.city}/${tenant.location.state}, ${writtenDate(input.issuedOn)}.`,
    signee: input.signee,
    signature: [officialName(tenant)],
    footer: `${officialName(tenant)} · Comprovante de ciência · ${tenant.legalFooter}`,
  };
}
