/**
 * Protocol numbers the citizen reads out loud over the phone and copies from a
 * printed form. The prefix says what kind of thing it is, which is why one
 * lookup field can serve requests, appointments, data rights and complaints.
 */
export const PROTOCOL_PREFIXES = {
  serviceRequest: "REQ",
  appointment: "AGD",
  dataRights: "SOL",
  ombudsman: "OUV",
} as const;

export type ProtocolPrefix =
  (typeof PROTOCOL_PREFIXES)[keyof typeof PROTOCOL_PREFIXES];

/** How each kind of protocol is named back to the citizen, in the lookup. */
export const PROTOCOL_TYPE_LABELS: Record<ProtocolPrefix, string> = {
  REQ: "Pedido de serviço",
  AGD: "Agendamento",
  SOL: "Requerimento LGPD",
  OUV: "Manifestação de ouvidoria",
};

const SEQUENCE_DIGITS = 6;
const PATTERN = /^([A-Z]{3})\.(\d{4})\.(\d{6})$/;

export interface ParsedProtocol {
  prefix: string;
  year: number;
  sequence: number;
}

/**
 * The sequence restarts every year, per office. Six digits is a hundred years
 * of headroom for a municipal office and still short enough to dictate.
 */
export function formatProtocolNumber(
  prefix: ProtocolPrefix,
  year: number,
  sequence: number,
): string {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new Error(`Ano invalido para protocolo: ${year}`);
  }
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(`Sequencia invalida para protocolo: ${sequence}`);
  }
  if (sequence >= 10 ** SEQUENCE_DIGITS) {
    throw new Error(
      `Sequencia estourou ${SEQUENCE_DIGITS} digitos no ano ${year}.`,
    );
  }
  return `${prefix}.${year}.${String(sequence).padStart(SEQUENCE_DIGITS, "0")}`;
}

/**
 * Accepts what a person types: lowercase, spaces around it, and the spacing
 * that comes from a copy and paste. Returns undefined when it is not a
 * protocol at all, so the caller can say so instead of querying for nothing.
 */
export function parseProtocolNumber(value: string): ParsedProtocol | undefined {
  const match = PATTERN.exec(value.trim().toUpperCase().replace(/\s+/g, ""));
  if (!match) return undefined;
  return {
    prefix: match[1],
    year: Number(match[2]),
    sequence: Number(match[3]),
  };
}
