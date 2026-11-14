import {
  type CensecAct,
  type CensecAsset,
  type CensecParty,
  type Central,
  emptyAct,
  isCentral,
} from "./censec.ts";

/**
 * The act as the screen sends and shows it: plain fields, the parties as
 * "party.N.field", the bens as "asset.N.field", the original act as
 * "ref.field", the testador as "testator.field" and the revoked testamento
 * as "revocation.field". Every field is editable (decision of 14/11/2026:
 * "tudo é editável").
 */

export const MAX_PARTIES = 40;
export const MAX_ASSETS = 20;

const line = (value: string | undefined, max = 300) =>
  (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const long = (value: string | undefined, max = 2000) =>
  (value ?? "").replace(/\r\n?/g, "\n").trim().slice(0, max);
const digits = (value: string | undefined, max: number) =>
  (value ?? "").replace(/\D/g, "").slice(0, max);

/** "10/10/2026" or "2026-10-10" → ISO; blank stays blank; else null. */
function isoOf(value: string | undefined): string | null {
  const text = (value ?? "").trim();
  if (!text) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  const [y, m, d] = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : br
      ? [Number(br[3]), Number(br[2]), Number(br[1])]
      : [0, 0, 0];
  const date = new Date(Date.UTC(y, m - 1, d));
  if (!y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d)
    return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "1.234,56" → 123456; blank → null; unreadable → undefined. */
function centsOf(value: string | undefined): number | null | undefined {
  const text = (value ?? "").replace(/R\$\s*/i, "").trim();
  if (!text) return null;
  const normalized = text.includes(",")
    ? text.replace(/\./g, "").replace(",", ".")
    : text;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined;
}

const money = (cents: number | null) =>
  cents === null
    ? ""
    : (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

export function actFromForm(form: Record<string, string>): {
  act: CensecAct;
  problems: string[];
} {
  const problems: string[] = [];
  const get = (key: string) => form[key] ?? "";
  const date = (key: string, label: string) => {
    const iso = isoOf(get(key));
    if (iso === null)
      problems.push(`${label}: data inválida (use dd/mm/aaaa).`);
    return iso ?? "";
  };
  const value = (key: string, label: string) => {
    const cents = centsOf(get(key));
    if (cents === undefined) {
      problems.push(`${label}: escreva só o valor, como 150.000,00.`);
      return null;
    }
    return cents;
  };
  const central: Central = isCentral(get("central"))
    ? (get("central") as Central)
    : "cep";
  const act = emptyAct(central);
  act.kind = line(get("kind"), 60);
  act.nature = line(get("nature"), 60);
  act.mne = digits(get("mne"), 24);
  act.date = date("date", "Data do ato");
  act.book = digits(get("book"), 15);
  act.bookSuffix = line(get("bookSuffix"), 50);
  act.page = digits(get("page"), 10);
  act.pageSuffix = line(get("pageSuffix"), 50);
  act.valueCents = value("value", "Valor do ato");
  act.regime = line(get("regime"), 60);
  act.contractDate = date("contractDate", "Data do contrato");
  act.validity = date("validity", "Validade da procuração");
  act.reserve =
    get("reserve") === "sim" ? "sim" : get("reserve") === "nao" ? "nao" : "";
  act.litigation = line(get("litigation"), 40);
  act.agreement =
    get("agreement") === "sim"
      ? "sim"
      : get("agreement") === "nao"
        ? "nao"
        : "";
  act.complement = line(get("complement"), 50);
  act.marriageDate = date("marriageDate", "Data do casamento");
  act.adultChildren = digits(get("adultChildren"), 2);
  act.minorChildren = digits(get("minorChildren"), 2);
  act.custody = line(get("custody"), 30);
  act.observations = long(get("observations"), 2000);
  act.notes = long(get("notes"), 5000);
  act.testator = {
    name: line(get("testator.name"), 150),
    cpf: line(get("testator.cpf"), 14),
    birthDate: date("testator.birthDate", "Nascimento do testador"),
    mother: line(get("testator.mother"), 150),
    father: line(get("testator.father"), 150),
    docType: line(get("testator.docType"), 20),
    doc: line(get("testator.doc"), 20),
    docComplement: line(get("testator.docComplement"), 20),
  };
  act.revocation = {
    cns: line(get("revocation.cns"), 9),
    date: date("revocation.date", "Data do testamento revogado"),
    book: digits(get("revocation.book"), 15),
    bookSuffix: line(get("revocation.bookSuffix"), 50),
    page: digits(get("revocation.page"), 12),
    pageSuffix: line(get("revocation.pageSuffix"), 50),
    unknown: line(get("revocation.unknown"), 100),
  };
  const ref = {
    kind: line(get("ref.kind"), 60),
    cns: line(get("ref.cns"), 9),
    book: digits(get("ref.book"), 20),
    bookSuffix: line(get("ref.bookSuffix"), 50),
    page: digits(get("ref.page"), 20),
    pageSuffix: line(get("ref.pageSuffix"), 50),
    country: line(get("ref.country"), 150),
  };
  act.references = ref.cns || ref.book || ref.page || ref.kind ? [ref] : [];
  for (let i = 0; i < MAX_PARTIES; i++) {
    const p = (field: string) => get(`party.${i}.${field}`);
    if (!p("name").trim()) continue;
    const party: CensecParty = {
      name: line(p("name"), 150),
      quality: line(p("quality"), 40),
      docType: line(p("docType"), 30),
      docNumber: line(p("docNumber"), 50),
      identity: line(p("identity"), 25),
      issuer: line(p("issuer"), 20),
      foreign: p("foreign") === "sim",
      spouse:
        p("spouse") === "Conjuge1" || p("spouse") === "Conjuge2"
          ? (p("spouse") as "Conjuge1" | "Conjuge2")
          : "",
      birthDate: date(
        `party.${i}.birthDate`,
        `Nascimento de ${line(p("name"), 60)}`,
      ),
      birthCountry: line(p("birthCountry"), 60),
      birthUf: line(p("birthUf"), 2).toUpperCase(),
      residenceCountry: line(p("residenceCountry"), 60),
      residenceUf: line(p("residenceUf"), 2).toUpperCase(),
      residenceCity: digits(p("residenceCity"), 7),
      sex: p("sex") === "F" || p("sex") === "M" ? (p("sex") as "F" | "M") : "",
      oab: digits(p("oab"), 10),
      oabUf: line(p("oabUf"), 2).toUpperCase(),
    };
    act.parties.push(party);
  }
  for (let i = 0; i < MAX_ASSETS; i++) {
    const a = (field: string) => get(`asset.${i}.${field}`);
    if (
      !a("description").trim() &&
      !a("value").trim() &&
      !a("matricula").trim()
    )
      continue;
    const asset: CensecAsset = {
      description: long(a("description"), 2000),
      valueCents: value(`asset.${i}.value`, `Valor do bem ${i + 1}`),
      fiscalCents: value(`asset.${i}.fiscal`, `Valor fiscal do bem ${i + 1}`),
      paymentForm: line(a("paymentForm"), 30),
      paymentTerm: line(a("paymentTerm"), 30),
      matricula: line(a("matricula"), 15),
      cnm: digits(a("cnm"), 16),
    };
    act.assets.push(asset);
  }
  return { act, problems };
}

export function actToForm(act: CensecAct): Record<string, string> {
  const out: Record<string, string> = {
    central: act.central,
    kind: act.kind,
    nature: act.nature,
    mne: act.mne,
    date: act.date,
    book: act.book,
    bookSuffix: act.bookSuffix,
    page: act.page,
    pageSuffix: act.pageSuffix,
    value: money(act.valueCents),
    regime: act.regime,
    contractDate: act.contractDate,
    validity: act.validity,
    reserve: act.reserve,
    litigation: act.litigation,
    agreement: act.agreement,
    complement: act.complement,
    marriageDate: act.marriageDate,
    adultChildren: act.adultChildren,
    minorChildren: act.minorChildren,
    custody: act.custody,
    observations: act.observations,
    notes: act.notes,
  };
  for (const [k, v] of Object.entries(act.testator)) out[`testator.${k}`] = v;
  for (const [k, v] of Object.entries(act.revocation))
    out[`revocation.${k}`] = v;
  const ref = act.references[0];
  if (ref) for (const [k, v] of Object.entries(ref)) out[`ref.${k}`] = v;
  act.parties.forEach((p, i) => {
    for (const [k, v] of Object.entries(p)) {
      out[`party.${i}.${k}`] = typeof v === "boolean" ? (v ? "sim" : "") : v;
    }
  });
  act.assets.forEach((a, i) => {
    out[`asset.${i}.description`] = a.description;
    out[`asset.${i}.value`] = money(a.valueCents);
    out[`asset.${i}.fiscal`] = money(a.fiscalCents);
    out[`asset.${i}.paymentForm`] = a.paymentForm;
    out[`asset.${i}.paymentTerm`] = a.paymentTerm;
    out[`asset.${i}.matricula`] = a.matricula;
    out[`asset.${i}.cnm`] = a.cnm;
  });
  return out;
}
