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

/** The three parts, whatever sits between them (or nothing at all). */
const LOOSE = /^([A-Z]{3})[^A-Z0-9]*(\d{4})[^A-Z0-9]*(\d{6})$/;

/**
 * The protocol as it is stored, from however it was typed (decision of
 * 22/11/2026: "que funcione tanto com o hífen como sem o hífen, ou é
 * ponto"): "req 2026 000123", "REQ-2026-000123" and "REQ2026000123" are all
 * "REQ.2026.000123". Anything that is not a protocol comes back trimmed and
 * upper-cased, so a lookup simply finds nothing.
 */
export function normalizeProtocolNumber(value: string): string {
  const compact = value.trim().toUpperCase().replace(/\s+/g, "");
  const match = LOOSE.exec(compact);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : compact;
}

/**
 * The link the receipt's QR code opens (decision of 22/11/2026): the
 * consult page ("/acompanhar") with the protocol in the query and the key
 * in the fragment, the same link the access-key e-mail carries. The
 * fragment never leaves the browser (not in the request, a server log or a
 * Referer); the page reads it, wipes it from the address and opens the
 * request at once.
 */
export function protocolAccessLink(
  origin: string,
  protocolNumber: string,
  accessKey: string,
): string {
  return `${origin}/acompanhar?numero=${encodeURIComponent(protocolNumber)}#chave=${encodeURIComponent(accessKey)}`;
}

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
  const match = PATTERN.exec(normalizeProtocolNumber(value));
  if (!match) return undefined;
  return {
    prefix: match[1],
    year: Number(match[2]),
    sequence: Number(match[3]),
  };
}
