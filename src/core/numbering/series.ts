import { z } from "zod";
import { formatGuideNumber } from "../guides/schema.ts";
import { formatProtocolNumber } from "../request/protocol.ts";

/**
 * Every numbered document the platform issues, in one catalogue (product
 * decision of 09/11/2026): an office that already numbered by hand (the
 * guias at 019/2026 in the book) tells the platform where to go on, year by
 * year. Configurações › Numeração lists exactly what is here, so a new
 * numbered document is registered here and shows up there by itself.
 *
 * Each number restarts every year, per office. What the office sets is the
 * floor of the next number: the next one is the larger of that floor and
 * the last one used plus one, so a number never repeats. The guias go
 * further: a deleted guia's number is free again (`lowestFree`).
 */
export const NUMBER_SERIES = [
  "guia",
  "REQ",
  "AGD",
  "SOL",
  "OUV",
  "notificacao",
  "declaracao-iss",
  "oficio-papel",
  "pedido-papel",
] as const;
export type NumberSeries = (typeof NUMBER_SERIES)[number];

export interface SeriesInfo {
  label: string;
  /** Where the number appears, under the name. */
  hint: string;
  format: (year: number, sequence: number) => string;
  /** Biggest sequence the printed format holds. */
  max: number;
}

export const SERIES_INFO: Record<NumberSeries, SeriesInfo> = {
  guia: {
    label: "Guias de transmissão de bens",
    hint: "Utilitários › Guias de transmissão de bens.",
    format: formatGuideNumber,
    max: 99_999,
  },
  REQ: {
    label: "Pedidos de serviço",
    hint: "Protocolo do pedido feito pelo site ou no balcão.",
    format: (year, sequence) => formatProtocolNumber("REQ", year, sequence),
    max: 999_999,
  },
  AGD: {
    label: "Agendamentos",
    hint: "Protocolo do agendamento.",
    format: (year, sequence) => formatProtocolNumber("AGD", year, sequence),
    max: 999_999,
  },
  SOL: {
    label: "Requerimentos LGPD",
    hint: "Protocolo do requerimento do titular de dados.",
    format: (year, sequence) => formatProtocolNumber("SOL", year, sequence),
    max: 999_999,
  },
  OUV: {
    label: "Ouvidoria",
    hint: "Protocolo da manifestação.",
    format: (year, sequence) => formatProtocolNumber("OUV", year, sequence),
    max: 999_999,
  },
  notificacao: {
    label: "Notificações de auditoria",
    hint: "Auditoria › notificação para esclarecimentos.",
    format: formatGuideNumber,
    max: 99_999,
  },
  "declaracao-iss": {
    label: "Declarações de ISS",
    hint: "Utilitários › Declaração de ISS.",
    format: formatGuideNumber,
    max: 99_999,
  },
  "oficio-papel": {
    label: "Ofícios do papel de segurança",
    hint: "Utilitários › Papel de segurança: comunicação de extravio e prestação de contas à Corregedoria.",
    format: formatGuideNumber,
    max: 99_999,
  },
  "pedido-papel": {
    label: "Pedidos de papéis de segurança",
    hint: "Utilitários › Solicitação de papéis de segurança.",
    format: formatGuideNumber,
    max: 99_999,
  },
};

/** { "guia": { "2026": 20 } }: the floor of the next number, per year. */
export type DocumentNumbering = Partial<
  Record<NumberSeries, Record<string, number>>
>;

const yearKey = z.string().regex(/^(20\d\d|2100)$/);
const floor = z.number().int().min(1).max(999_999);

/** What is stored, read leniently: anything malformed is left out. */
export function parseDocumentNumbering(raw: unknown): DocumentNumbering {
  const result: DocumentNumbering = {};
  if (!raw || typeof raw !== "object") return result;
  for (const series of NUMBER_SERIES) {
    const years = (raw as Record<string, unknown>)[series];
    if (!years || typeof years !== "object") continue;
    const kept: Record<string, number> = {};
    for (const [year, value] of Object.entries(years)) {
      if (
        yearKey.safeParse(year).success &&
        floor.safeParse(value).success &&
        (value as number) <= SERIES_INFO[series].max
      ) {
        kept[year] = value as number;
      }
    }
    if (Object.keys(kept).length) result[series] = kept;
  }
  return result;
}

/** The next number: the office's floor or the last used plus one. */
export function nextSequence(
  lastUsed: number,
  officeFloor: number | undefined,
): number {
  return Math.max(lastUsed + 1, officeFloor ?? 1);
}

/**
 * The guias' next number: the lowest one free from the floor on, so a guia
 * deleted (a test, a mistake) leaves its number to the next one, even in the
 * middle of the year's run.
 */
export function lowestFree(
  used: readonly number[],
  officeFloor: number | undefined,
): number {
  const taken = new Set(used);
  let candidate = Math.max(officeFloor ?? 1, 1);
  while (taken.has(candidate)) candidate += 1;
  return candidate;
}

/**
 * The series whose deleted documents give their number back (a test, a
 * mistake): the next one takes the lowest number free from the floor on.
 * Protocols never do: the citizen already holds the number.
 */
export const REUSES_FREED_NUMBERS: readonly NumberSeries[] = [
  "guia",
  "declaracao-iss",
];

export function reusesFreedNumbers(series: NumberSeries): boolean {
  return REUSES_FREED_NUMBERS.includes(series);
}

export function floorOf(
  numbering: DocumentNumbering,
  series: NumberSeries,
  year: number,
): number | undefined {
  return numbering[series]?.[String(year)];
}

/**
 * Checks what the office typed for one series and year. A number already
 * used, or behind one, would repeat: refused, with the next free one named.
 */
export function checkFloor(
  series: NumberSeries,
  year: number,
  next: number,
  lastUsed: number,
  /** The live numbers, for a series that reuses freed ones. */
  used?: readonly number[],
): string | undefined {
  const info = SERIES_INFO[series];
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return "Informe o ano com quatro dígitos.";
  }
  if (!Number.isInteger(next) || next < 1 || next > info.max) {
    return `Informe um número entre 1 e ${info.max.toLocaleString("pt-BR")}.`;
  }
  if (reusesFreedNumbers(series) && used) {
    // A freed number (a test deleted) may be taken again; one in use not.
    return used.includes(next)
      ? `O número ${info.format(year, next)} já está em uso. O próximo livre a partir dele é ${info.format(year, lowestFree(used, next))}. Para usar o ${info.format(year, next)}, exclua o documento que está com ele (por exemplo, um de teste).`
      : undefined;
  }
  if (next <= lastUsed) {
    return `Já foi usado até ${info.format(year, lastUsed)}. O próximo precisa ser ${info.format(year, lastUsed + 1)} ou maior.`;
  }
  return undefined;
}
