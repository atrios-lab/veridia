import { formatTaxId, isValidTaxId } from "../tax-id.ts";
import {
  type CIVIL_STATUSES,
  emptyParty,
  type Guide,
  type GuideParty,
} from "./schema.ts";

/**
 * What the documents attached to a guia say, read from their text
 * (decision of 14/11/2026: "você fará a leitura e preencherá as
 * informações necessárias, deixando apenas o cliente ou o funcionário
 * conferir e salvar"). Only what is written plainly is taken: a
 * qualification with a valid CPF or CNPJ, the matrícula, the inscrição
 * imobiliária, the description of the imóvel and a value in reais. Nothing
 * is guessed: what the text does not say stays blank, and every field read
 * is marked for the person to check.
 */

export type CivilStatus = (typeof CIVIL_STATUSES)[number];

export interface ReadParty {
  role?: "transmitente" | "adquirente";
  name: string;
  taxId: string;
  gender?: "feminino" | "masculino";
  civilStatus?: CivilStatus;
  profession?: string;
  address?: string;
}

export interface GuideReading {
  parties: ReadParty[];
  property: {
    type?: "urbano" | "rural";
    description?: string;
    fiscalRegistration?: string;
    registration?: string;
  };
  declaredValueCents?: number;
}

const flat = (text: string) => text.replace(/\s+/g, " ").trim();

const TAX_ID =
  /\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/g;

const UPPER = "A-ZÀ-ÖØ-Þ";
const NAME = new RegExp(
  `([${UPPER}][${UPPER}'´\\-]+(?:\\s+(?:D[AEO]S?|E|[${UPPER}][${UPPER}'´\\-]+)){1,8})\\s*,`,
  "u",
);

const TRANSMITS =
  /(vendedor|vendedora|outorgantes?|transmitente|doador|doadora|cedente|propriet[áa]ri[oa]s?\s+atua(?:l|is))/gi;
const ACQUIRES =
  /(comprador|compradora|outorgad[oa]s?|adquirente|donat[áa]ri[oa]|cession[áa]ri[oa])/gi;

function lastIndexOf(re: RegExp, text: string): number {
  let last = -1;
  for (const match of text.matchAll(re)) last = match.index ?? last;
  return last;
}

/** The role named nearest before the person, if any. */
function roleBefore(text: string): ReadParty["role"] {
  const t = lastIndexOf(TRANSMITS, text);
  const a = lastIndexOf(ACQUIRES, text);
  if (t < 0 && a < 0) return undefined;
  return t > a ? "transmitente" : "adquirente";
}

const CIVIL: [RegExp, CivilStatus][] = [
  [/\bsolteir[oa]\b/i, "solteiro"],
  [/\bcasad[oa]\b/i, "casado"],
  [/\bdivorciad[oa]\b/i, "divorciado"],
  [/\bvi[úu]v[oa]\b/i, "viuvo"],
  [/\bseparad[oa]\b/i, "separado"],
];

/** "brasileira, casada" → feminino; "brasileiro" → masculino. */
function genderOf(text: string): ReadParty["gender"] {
  const word =
    /\b(brasileir|portugues|solteir|casad|divorciad|vi[úu]v|separad|nascid)(a|o|es)\b/i.exec(
      text,
    );
  if (!word) return undefined;
  return word[2]?.toLowerCase() === "a" ? "feminino" : "masculino";
}

/** The word after the civil status, when it is a profession. */
function professionOf(text: string): string | undefined {
  const match =
    /\b(?:solteir|casad|divorciad|vi[úu]v|separad)[oa]s?(?:\s+[^,]*)?,\s*([a-zà-ÿ][a-zà-ÿ\s]{2,40}?),/i.exec(
      text,
    );
  const word = match?.[1]?.trim();
  if (!word) return undefined;
  if (
    /^(maior|menor|capaz|portador|inscrit|residente|nascid|natural)/i.test(word)
  ) {
    return undefined;
  }
  return word;
}

function addressAfter(text: string): string | undefined {
  const match =
    /residentes?\s+e\s+domiciliad[oa]s?\s+(?:na|no|à|a|em)\s+(.{5,240}?)(?:;|\.\s|,\s*(?:e|neste ato|doravante|como)\b|$)/i.exec(
      text,
    );
  return match?.[1]?.trim().replace(/,$/, "");
}

/** Each qualification: a valid CPF or CNPJ with the name before it. */
function partiesOf(text: string): ReadParty[] {
  const parties: ReadParty[] = [];
  const seen = new Set<string>();
  let previousEnd = 0;
  for (const match of text.matchAll(TAX_ID)) {
    const raw = match[1] ?? "";
    const at = match.index ?? 0;
    const digits = raw.replace(/\D/g, "");
    if (!isValidTaxId(digits)) continue;
    const before = text.slice(Math.max(previousEnd, at - 600), at);
    previousEnd = at + raw.length;
    // The qualification starts after the last ";" or label colon.
    const chunk = before.split(/;|:\s/).at(-1) ?? before;
    const name = NAME.exec(chunk)?.[1]?.trim();
    if (!name || seen.has(digits)) continue;
    seen.add(digits);
    const after = text.slice(at, at + 400);
    const around = `${chunk} ${after}`;
    parties.push({
      role: roleBefore(
        text.slice(Math.max(0, at - 1500), at - chunk.length + name.length),
      ),
      name,
      taxId: formatTaxId(digits),
      gender: digits.length === 11 ? genderOf(chunk) : undefined,
      civilStatus:
        digits.length === 11
          ? CIVIL.find(([re]) => re.test(chunk))?.[1]
          : undefined,
      profession: digits.length === 11 ? professionOf(chunk) : undefined,
      address: addressAfter(around),
    });
  }
  return parties;
}

/** "123.456,78" → 12345678. */
function centsOf(text: string): number | undefined {
  const clean = text.replace(/\./g, "").replace(",", ".");
  const value = Number(clean);
  return Number.isFinite(value) && value > 0
    ? Math.round(value * 100)
    : undefined;
}

export function readGuideText(raw: string): GuideReading {
  const text = flat(raw);
  const registration =
    /MATR[ÍI]CULA\s*(?:N[º°o]\.?|N\.?\s*º)?\s*:?\s*(\d[\d.]*\d|\d)/i.exec(
      text,
    )?.[1] ?? /\b(?:R|AV)-\d+-(\d[\d.]*\d)\b/.exec(text)?.[1];
  const fiscal =
    /INSCRI[ÇC][ÃA]O\s+(?:IMOBILI[ÁA]RIA|MUNICIPAL|CADASTRAL)[^:\d]{0,20}:?\s*(\d[\d.\-/ ]{1,30}\d)/i.exec(
      text,
    )?.[1];
  const description =
    /IM[ÓO]VEL\s+(?:URBANO|RURAL)\s*:?\s*(.{20,600}?)(?=\s*(?:INSCRI[ÇC][ÃA]O|NOME, DOMIC|REGISTRO ANTERIOR|PROPRIET[ÁA]RI|$))/i.exec(
      text,
    )?.[1];
  const value =
    /(?:valor|pre[çc]o|quantia|import[âa]ncia).{0,80}?R\$\s*([\d.]+,\d{2})/i.exec(
      text,
    )?.[1];
  return {
    parties: partiesOf(text),
    property: {
      type: /IM[ÓO]VEL\s+RURAL/i.test(text)
        ? "rural"
        : /IM[ÓO]VEL\s+URBANO/i.test(text)
          ? "urbano"
          : undefined,
      description: description?.trim(),
      fiscalRegistration: fiscal?.trim(),
      registration,
    },
    declaredValueCents: value ? centsOf(value) : undefined,
  };
}

/** Several documents into one reading: the first value found wins. */
export function mergeReadings(readings: GuideReading[]): GuideReading {
  const out: GuideReading = { parties: [], property: {} };
  const seen = new Set<string>();
  for (const reading of readings) {
    for (const party of reading.parties) {
      const key = party.taxId.replace(/\D/g, "");
      if (seen.has(key)) continue;
      seen.add(key);
      out.parties.push(party);
    }
    for (const [key, value] of Object.entries(reading.property)) {
      const k = key as keyof GuideReading["property"];
      if (value && !out.property[k])
        (out.property as Record<string, string>)[k] = value;
    }
    out.declaredValueCents ??= reading.declaredValueCents;
  }
  return out;
}

/** Whether the reading found anything at all. */
export function readSomething(reading: GuideReading): boolean {
  return (
    reading.parties.length > 0 ||
    Object.values(reading.property).some(Boolean) ||
    Boolean(reading.declaredValueCents)
  );
}

/**
 * The panel's guia with what the documents say: only blank fields are
 * filled, a party already there (same CPF or CNPJ) is not repeated, and a
 * blank party of the same side takes the first one read.
 */
export function fillGuide(guide: Guide, reading: GuideReading): Guide {
  const parties = [...guide.parties];
  for (const person of reading.parties) {
    const digits = person.taxId.replace(/\D/g, "");
    if (parties.some((p) => p.taxId.replace(/\D/g, "") === digits)) continue;
    const role = person.role ?? "transmitente";
    const filled: GuideParty = {
      ...emptyParty(role),
      personType: digits.length === 14 ? "juridica" : "fisica",
      name: person.name,
      taxId: person.taxId,
      gender: person.gender ?? "feminino",
      civilStatus: person.civilStatus,
      profession: person.profession ?? "",
      address: person.address ?? "",
    };
    const blank = parties.findIndex(
      (p) => p.role === role && !p.name.trim() && !p.taxId.trim(),
    );
    if (blank >= 0) parties[blank] = filled;
    else parties.push(filled);
  }
  return {
    ...guide,
    parties,
    property: {
      ...guide.property,
      type: guide.property.description
        ? guide.property.type
        : (reading.property.type ?? guide.property.type),
      description:
        guide.property.description || reading.property.description || "",
      fiscalRegistration:
        guide.property.fiscalRegistration ||
        reading.property.fiscalRegistration ||
        "",
      registration:
        guide.property.registration || reading.property.registration || "",
    },
    declaredValueCents:
      guide.declaredValueCents || reading.declaredValueCents || 0,
  };
}
