import { addresseeRows, type IssSettings } from "../iss/declaration.ts";
import type { RequerimentoDocument } from "../request/requerimento.ts";
import { writtenDate } from "../scheduling/attendance.ts";
import { officialName } from "../tenant/identification.ts";
import type { Tenant } from "../tenant/schema.ts";
import {
  competenceLabel,
  deadlineOf,
  formatCents,
  OPERATIONS,
  SERVICES,
  type TitleTransfer,
  type TransferParty,
} from "./titularidade.ts";

/**
 * The month's communication to the Secretaria Municipal de Tributação
 * (CNN, art. 184-A): an ofício with the list of the acts that changed the
 * ownership of imóveis, each one with the data the cadastro needs, or the
 * declaration that there was none. Written for this panel from the norm;
 * signed digitally through the platform or printed to sign by hand, like
 * every other paper of the panel.
 */

export interface OficioInput {
  number: string;
  competence: string;
  /** The acts of the competence, in date order. */
  transfers: TitleTransfer[];
  settings: IssSettings;
  /** The day the ofício is dated (ISO). */
  issuedOn: string;
}

const people = (parties: TransferParty[]) =>
  parties
    .map((p) =>
      [p.name, p.taxId && `(${p.taxId})`, p.share && `${p.share}`]
        .filter(Boolean)
        .join(" "),
    )
    .join("; ") || "Não consta";

function operationOf(t: TitleTransfer): string {
  return t.operation === "39" && t.operationOther
    ? `Outras: ${t.operationOther}`
    : (OPERATIONS[t.operation] ?? "Não informado");
}

function actOf(t: TitleTransfer): string {
  const service = SERVICES[t.service];
  const act = (service.acts as Record<string, string>)[t.act] ?? t.act;
  const where =
    t.service === "notas"
      ? [t.book && `livro ${t.book}`, t.page && `folhas ${t.page}`]
      : [t.entry && t.entry, t.matricula && `matrícula ${t.matricula}`];
  return [act, ...where].filter(Boolean).join(", ");
}

function propertyOf(t: TitleTransfer): string {
  return [
    t.destination && `Imóvel ${t.destination}`,
    t.matricula &&
      `matrícula ${t.matricula}${t.registry ? ` (${t.registry})` : ""}`,
    t.fiscalRegistration && `inscrição imobiliária ${t.fiscalRegistration}`,
    t.address,
  ]
    .filter(Boolean)
    .join(", ");
}

const isoDate = (iso: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
    : "";

function holderLines(
  tenant: Pick<Tenant, "holderName" | "holderTitle" | "officialName" | "name">,
) {
  return {
    signee: tenant.holderName ?? officialName(tenant),
    signature: [tenant.holderTitle ?? "Tabelião(ã) e Registrador(a)"],
  };
}

export function buildOficio(
  tenant: Tenant,
  input: OficioInput,
): RequerimentoDocument {
  const month = competenceLabel(input.competence);
  const { transfers } = input;
  const services = [...new Set(transfers.map((t) => t.service))];
  const platforms = (services.length ? services : (["notas"] as const))
    .map((s) => SERVICES[s].platform)
    .join(" e ");
  const none = transfers.length === 0;
  return {
    eyebrow: "Comunicação à Fazenda Municipal",
    title: `Ofício nº ${input.number}`,
    subtitle: none
      ? `Mudanças de titularidade de imóveis · ${month} · sem movimento`
      : `Mudanças de titularidade de imóveis · ${month} · ${transfers.length} ${transfers.length === 1 ? "ato" : "atos"}`,
    office: [officialName(tenant), tenant.subtitle],
    sections: [
      { heading: "Destinatário", rows: addresseeRows(tenant, input.settings) },
      {
        heading: "Comunicação",
        paragraphs: [
          "Senhor(a) Secretário(a),",
          none
            ? `Em cumprimento ao art. 184-A do Código Nacional de Normas da Corregedoria Nacional de Justiça (Provimento CNJ nº 149/2023, com a redação do Provimento CN nº 174/2024), que regulamenta o art. 4º da Resolução CNJ nº 547/2024, comunico a Vossa Senhoria que, em ${month}, não foi praticado nesta serventia ato que importasse mudança na titularidade de imóveis.`
            : `Em cumprimento ao art. 184-A do Código Nacional de Normas da Corregedoria Nacional de Justiça (Provimento CNJ nº 149/2023, com a redação do Provimento CN nº 174/2024), que regulamenta o art. 4º da Resolução CNJ nº 547/2024, encaminho a Vossa Senhoria a relação dos atos praticados nesta serventia em ${month} que importaram mudança na titularidade de imóveis, para a atualização do cadastro de contribuintes desta Fazenda Municipal.`,
          "As hipóteses comunicadas são as mesmas da Declaração sobre Operações Imobiliárias (DOI) entregue à Receita Federal do Brasil, com a indicação do ato ou fato jurídico que ensejou a transmissão (art. 184-A, §§ 1º e 3º). O fornecimento destas informações ao Município é feito sem cobrança de custas ou emolumentos (art. 184-A, § 9º).",
          `As mesmas informações são remetidas por meio eletrônico, mediante recibo de entrega, à ${platforms}, na forma do art. 184-A, § 2º. Os dados pessoais aqui contidos destinam-se exclusivamente à atualização cadastral e estão protegidos pelo sigilo fiscal e pela Lei nº 13.709/2018 (LGPD).`,
        ],
      },
      ...(none
        ? []
        : [
            {
              heading: "Relação dos atos",
              table: {
                columns: [
                  { label: "Nº", weight: 0.4 },
                  { label: "Data", weight: 0.9 },
                  { label: "Operação", weight: 1.4 },
                  { label: "Imóvel", weight: 2.2 },
                  { label: "Adquirente(s)", weight: 2 },
                ],
                rows: transfers.map((t, i) => [
                  String(i + 1),
                  isoDate(t.actDate),
                  operationOf(t),
                  propertyOf(t) || "Não identificado",
                  people(t.adquirentes),
                ]),
              },
            },
            ...transfers.map((t, i) => ({
              heading: `Ato ${i + 1}: ${operationOf(t)}`,
              rows: [
                { label: "Ato", value: actOf(t) },
                { label: "Data", value: isoDate(t.actDate) },
                { label: "Imóvel", value: propertyOf(t) || "Não identificado" },
                ...(t.description
                  ? [{ label: "Descrição", value: t.description }]
                  : []),
                { label: "Transmitente(s)", value: people(t.transmitentes) },
                { label: "Adquirente(s)", value: people(t.adquirentes) },
                {
                  label: "Valor declarado",
                  value: formatCents(t.valueCents) || "Não consta no título",
                },
                {
                  label: "Base de cálculo do ITBI/ITCMD",
                  value: formatCents(t.taxBaseCents) || "Não consta no título",
                },
                ...(t.notes ? [{ label: "Observações", value: t.notes }] : []),
              ],
            })),
          ]),
    ],
    dateLine: `${tenant.location.city}/${tenant.location.state}, ${writtenDate(input.issuedOn)}.`,
    ...holderLines(tenant),
    footer: `${officialName(tenant)} · ${tenant.legalFooter}`,
  };
}

/** "Prazo: até 30/11/2026" for the competence. */
export function deadlineLine(
  competence: string,
  holidays: Parameters<typeof deadlineOf>[1] = {},
): string {
  return `até ${isoDate(deadlineOf(competence, holidays))}`;
}

const csvCell = (value: string) =>
  /[;"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/**
 * The competence as a spreadsheet (one row per act, the DOI codes beside
 * the words), for the platform or for the prefeitura's own system. Opens
 * in Excel: semicolons and a BOM.
 */
export function transfersCsv(transfers: TitleTransfer[]): string {
  const header = [
    "Serviço",
    "Ato",
    "Data do ato",
    "Livro",
    "Folhas",
    "Registro/averbação",
    "Código da operação (DOI)",
    "Operação",
    "Destinação",
    "Matrícula",
    "Registro de imóveis",
    "Inscrição imobiliária",
    "Endereço",
    "Descrição",
    "Valor declarado",
    "Base de cálculo ITBI/ITCMD",
    "Transmitentes",
    "Adquirentes",
    "Observações",
  ];
  const money = (cents: number | null) =>
    cents === null ? "" : (cents / 100).toFixed(2).replace(".", ",");
  const rows = transfers.map((t) => [
    SERVICES[t.service].label,
    (SERVICES[t.service].acts as Record<string, string>)[t.act] ?? t.act,
    isoDate(t.actDate),
    t.book,
    t.page,
    t.entry,
    t.operation,
    operationOf(t),
    t.destination,
    t.matricula,
    t.registry,
    t.fiscalRegistration,
    t.address,
    t.description,
    money(t.valueCents),
    money(t.taxBaseCents),
    people(t.transmitentes),
    people(t.adquirentes),
    t.notes,
  ]);
  return `﻿${[header, ...rows]
    .map((row) => row.map((cell) => csvCell(String(cell ?? ""))).join(";"))
    .join("\r\n")}\r\n`;
}
