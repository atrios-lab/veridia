import { normalizeCpf } from "./form.ts";
import { type ParsedProtocol, parseProtocolNumber } from "./protocol.ts";

export type SearchTerm =
  | { type: "protocol"; raw: string; parsed: ParsedProtocol }
  | { type: "cpf"; raw: string; digits: string }
  | { type: "name"; raw: string };

const RAW_PROTOCOL_SHAPE = /^[A-Z]{3}\d{4}\d{6}$/;

/**
 * `parseProtocolNumber` only tolerates case and surrounding spaces, and a
 * search box gets typed at, dots and all dropped ("sol 2026 000031"). This
 * strips every non-alphanumeric character first and, only if what remains
 * has exactly the three-letter/four-digit/six-digit shape of a protocol,
 * reinserts the dots before handing it to the real parser.
 */
function looseProtocolCandidate(raw: string): string | undefined {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!RAW_PROTOCOL_SHAPE.test(compact)) return undefined;
  return `${compact.slice(0, 3)}.${compact.slice(3, 7)}.${compact.slice(7)}`;
}

/**
 * What the global search does with whatever a person typed: a recognisable
 * protocol number wins first, then eleven digits reads as a CPF (masked or
 * not, only the digit count decides: the check digits are not verified
 * here, the same way the citizen's own typo would still be worth searching
 * for), and everything else is a name.
 */
export function classifySearchTerm(raw: string): SearchTerm {
  const trimmed = raw.trim();
  const parsed = parseProtocolNumber(
    looseProtocolCandidate(trimmed) ?? trimmed,
  );
  if (parsed) return { type: "protocol", raw: trimmed, parsed };

  const digits = normalizeCpf(trimmed);
  if (digits.length === 11) return { type: "cpf", raw: trimmed, digits };

  return { type: "name", raw: trimmed };
}
