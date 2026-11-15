import { isValidCpf } from "../request/form.ts";
import { isValidCnpj } from "../tenant/pix.ts";

/**
 * Hides personal data from whatever a person types to the DPO assistant,
 * before the text is stored or leaves the server (decision of 15/11/2026:
 * "sobre os dados é só não vazar").
 *
 * Erring towards hiding is acceptable; letting a document through is not.
 * What must never change is the subject of the conversation itself: legal
 * citations ("Lei 13.709/2018, art. 18, § 4º"), deadlines ("23/09/2026"),
 * the platform's protocol numbers ("REQ-2026-000123") and amounts in reais.
 * The rules that recognise a document by its check digits (CPF, CNPJ, CNS)
 * are what keep a law's number from being taken for one.
 *
 * Proper names are not hidden: no local rule tells "Maria da Silva" from
 * "Registro Civil" safely. The screen asks people not to type them, and the
 * model is told never to ask for or repeat them (see the change's design).
 */

export const MASK_KINDS = [
  "email",
  "registry",
  "cnpj",
  "cpf",
  "cns",
  "keyed",
  "phone",
  "cep",
  "address",
  "birth",
  "number",
] as const;
export type MaskKind = (typeof MASK_KINDS)[number];

export type MaskCounts = Partial<Record<MaskKind, number>>;

export interface MaskResult {
  text: string;
  counts: MaskCounts;
}

/** The marker each kind leaves in the text. */
export const MASK_MARKERS: Record<Exclude<MaskKind, "keyed">, string> = {
  email: "[E-MAIL]",
  registry: "[MATRÍCULA]",
  cnpj: "[CNPJ]",
  cpf: "[CPF]",
  cns: "[CNS]",
  phone: "[TELEFONE]",
  cep: "[CEP]",
  address: "[ENDEREÇO]",
  birth: "[NASCIMENTO]",
  number: "[NÚMERO]",
};

/**
 * Documents recognised by the word written before the number: the number
 * alone could be anything, the word says what it is. Each label is the
 * marker the number becomes.
 */
const KEYED_DOCUMENTS: { pattern: string; marker: string }[] = [
  { pattern: "t[íi]tulo(?:\\s+de\\s+eleitor)?", marker: "[TÍTULO]" },
  { pattern: "cnh|carteira\\s+de\\s+motorista", marker: "[CNH]" },
  {
    pattern: "rg|identidade|c[ée]dula\\s+de\\s+identidade",
    marker: "[RG]",
  },
  { pattern: "pis|pasep|nis|nit", marker: "[NIS]" },
  { pattern: "passaporte", marker: "[PASSAPORTE]" },
  {
    pattern:
      "cns|cart[ãa]o\\s+(?:do\\s+)?sus|cart[ãa]o\\s+nacional\\s+de\\s+sa[úu]de",
    marker: "[CNS]",
  },
  { pattern: "cpf", marker: "[CPF]" },
];

function isValidCns(digits: string): boolean {
  if (digits.length !== 15 || !/^[1-2789]/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) sum += Number(digits[i]) * (15 - i);
  return sum % 11 === 0;
}

type Replacer = (text: string, counts: MaskCounts) => string;

function count(counts: MaskCounts, kind: MaskKind): void {
  counts[kind] = (counts[kind] ?? 0) + 1;
}

/** A pattern whose every match becomes the kind's marker. */
function always(kind: Exclude<MaskKind, "keyed">, pattern: RegExp): Replacer {
  return (text, counts) =>
    text.replace(pattern, () => {
      count(counts, kind);
      return MASK_MARKERS[kind];
    });
}

/** A pattern whose match becomes the marker only when `valid` agrees. */
function checked(
  kind: Exclude<MaskKind, "keyed">,
  pattern: RegExp,
  valid: (digits: string) => boolean,
): Replacer {
  return (text, counts) =>
    text.replace(pattern, (match) => {
      if (!valid(match.replace(/\D/g, ""))) return match;
      count(counts, kind);
      return MASK_MARKERS[kind];
    });
}

// A digit run is never glued to a letter, a slash or another digit: that is
// what keeps "13.709/2018", "art. 18" and "REQ-2026-000123" out of reach.
const START = "(?<![\\w/.-])";
const END = "(?![\\w/]|[.-]\\d)";

const MONTHS =
  "janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro";

const REPLACERS: Replacer[] = [
  always("email", /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g),
  // The registro civil's matrícula: 32 digits, often grouped.
  always("registry", /(?<!\d)\d(?:[\s.-]?\d){31}(?!\d)/g),
  checked(
    "cnpj",
    new RegExp(
      `${START}\\d{2}\\.?\\d{3}\\.?\\d{3}\\/?\\d{4}-?\\d{2}${END}`,
      "g",
    ),
    isValidCnpj,
  ),
  checked(
    "cpf",
    new RegExp(`${START}\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}${END}`, "g"),
    isValidCpf,
  ),
  checked(
    "cns",
    new RegExp(`${START}\\d{3}\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}${END}`, "g"),
    isValidCns,
  ),
  // A number written right after the document's name, whatever its shape.
  (text, counts) => {
    for (const { pattern, marker } of KEYED_DOCUMENTS) {
      const keyed = new RegExp(
        `\\b(${pattern})\\b(\\s*(?:n[º°o.]?|n[úu]mero|:|-)?\\s*)([\\dXx][\\dXx.\\s/-]{3,22}[\\dXx])`,
        "gi",
      );
      text = text.replace(keyed, (_match, word, glue) => {
        count(counts, "keyed");
        return `${word}${glue}${marker}`;
      });
    }
    return text;
  },
  // Phones: area code and number, with or without +55 and separators.
  always(
    "phone",
    new RegExp(
      `(?:\\+?55\\s?)?(?:\\(\\s?[1-9]{2}\\s?\\)|${START}[1-9]{2})\\s?9?\\s?\\d{4}[\\s.-]?\\d{4}${END}`,
      "g",
    ),
  ),
  // A mobile without the area code, written the usual way.
  always("phone", new RegExp(`${START}9\\d{4}-\\d{4}${END}`, "g")),
  always("cep", new RegExp(`${START}\\d{2}\\.?\\d{3}-\\d{3}${END}`, "g")),
  always("cep", /\b(?<=cep\s*:?\s*)\d{8}\b/gi),
  always(
    "address",
    /\b(?:rua|avenida|av\.|travessa|alameda|rodovia|estrada|pra[çc]a|largo|beco)\s+[^\n,;:]{2,60}?,?\s*(?:n[º°o.]?\s*)?\d+[a-z]?\b/gi,
  ),
  // A date close after a word about birth. Deadlines elsewhere stay.
  (text, counts) =>
    text.replace(
      new RegExp(
        `\\b(nasc\\w*|data\\s+de\\s+nascimento|d\\.?\\s?n\\.?)([^\\d\\n]{0,30}?)(\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}|\\d{1,2}º?\\s+de\\s+(?:${MONTHS})\\s+de\\s+\\d{4})`,
        "gi",
      ),
      (_match, word, glue) => {
        count(counts, "birth");
        return `${word}${glue}${MASK_MARKERS.birth}`;
      },
    ),
  // Whatever long number is left: no citation, deadline or amount has nine
  // digits in a row, and a document typed without its name usually does.
  always("number", new RegExp(`${START}\\d{9,}${END}`, "g")),
];

export function maskPersonalData(input: string): MaskResult {
  const counts: MaskCounts = {};
  let text = input;
  for (const replace of REPLACERS) text = replace(text, counts);
  return { text, counts };
}

/** How many items were hidden, all kinds together. */
export function maskedTotal(counts: MaskCounts): number {
  return Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);
}
