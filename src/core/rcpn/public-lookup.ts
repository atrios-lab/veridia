import { normalizeName } from "./names.ts";
import {
  RCPN_KIND_LABELS,
  type RcpnKind,
  type RcpnPerson,
  type RcpnSubtype,
} from "./record.ts";

/**
 * "Seu registro é daqui?" (change `consulta-de-registro-rcpn`, phase 2;
 * decision of 22/11/2026): anyone asks on the site whether a registro is in
 * this office's index, with the full name and the mother's full name; the
 * birth date is asked too, and only has to match when it is given. The
 * answer says only what was found: the kind of registro and the profession,
 * saying whose it is. It never says what is absent ("não é casado"), never
 * suggests a near name (that would show someone else's), and never shows
 * CPF, documents, book or page.
 */

/** Why the person asks: the LGPD base of the lookup, from a fixed list. */
export const LOOKUP_PURPOSES = [
  "Aposentadoria ou benefício do INSS",
  "Processo judicial ou administrativo",
  "Inventário, partilha ou herança",
  "Saber qual certidão pedir",
  "Pesquisa de família (genealogia)",
  "Outra finalidade",
] as const;
export type LookupPurpose = (typeof LOOKUP_PURPOSES)[number];

export interface LookupQuery {
  name: string;
  mother: string;
  /** "YYYY-MM-DD", or "" when the person does not know it. */
  birthDate: string;
}

export interface LookupCandidate {
  person: RcpnPerson;
  kind: RcpnKind;
  subtype: RcpnSubtype;
}

export interface LookupItem {
  kind: RcpnKind;
  /** "Nascimento", "Casamento", "Óbito" (or "Óbito (natimorto)"). */
  kindLabel: string;
  /** "do próprio registrado", "do pai"... with the profession, or a note. */
  professions: { whose: string; value: string }[];
  /** Said when no profession is in the digital data. */
  professionMissing: boolean;
}

export type LookupAnswer =
  | { found: false }
  | { found: true; items: LookupItem[]; dateChecked: boolean };

/** The same full name: every word, in order, accents and "de/da" aside. */
export function sameFullName(typed: string, registered: string): boolean {
  const a = normalizeName(typed);
  return a.length > 0 && a === normalizeName(registered);
}

/** A name worth looking up: at least a first name and a surname. */
export function isFullName(value: string): boolean {
  return normalizeName(value).split(" ").filter(Boolean).length >= 2;
}

function professionsOf(candidate: LookupCandidate) {
  const { person, kind } = candidate;
  const out: { whose: string; value: string }[] = [];
  // A child registered at birth has no profession of its own: the record
  // carries the parents'.
  if (kind === "nascimento") {
    if (person.fatherProfession.trim()) {
      out.push({ whose: "do pai", value: person.fatherProfession.trim() });
    }
    if (person.motherProfession.trim()) {
      out.push({ whose: "da mãe", value: person.motherProfession.trim() });
    }
    return out;
  }
  if (person.profession.trim()) {
    out.push({
      whose: kind === "obito" ? "da pessoa falecida" : "do cônjuge consultado",
      value: person.profession.trim(),
    });
  }
  return out;
}

/**
 * The answer from the candidates the index holds for that mother's name:
 * the full name must match (or the name adopted at marriage), and the
 * birth date too when it was given and the registro has one.
 */
export function answerLookup(
  query: LookupQuery,
  candidates: readonly LookupCandidate[],
): LookupAnswer {
  if (!isFullName(query.name) || !isFullName(query.mother)) {
    return { found: false };
  }
  const items: LookupItem[] = [];
  let dateChecked = false;
  for (const candidate of candidates) {
    const { person } = candidate;
    const nameOk =
      sameFullName(query.name, person.name) ||
      (person.marriedName.trim() !== "" &&
        sameFullName(query.name, person.marriedName));
    if (!nameOk || !sameFullName(query.mother, person.motherName)) continue;
    if (query.birthDate && person.birthDate) {
      if (query.birthDate !== person.birthDate) continue;
      dateChecked = true;
    }
    const professions = professionsOf(candidate);
    items.push({
      kind: candidate.kind,
      kindLabel:
        candidate.subtype === "natimorto"
          ? `${RCPN_KIND_LABELS[candidate.kind]} (natimorto)`
          : RCPN_KIND_LABELS[candidate.kind],
      professions,
      professionMissing: professions.length === 0,
    });
  }
  if (items.length === 0) return { found: false };
  const order: Record<RcpnKind, number> = {
    nascimento: 0,
    casamento: 1,
    obito: 2,
  };
  items.sort((a, b) => order[a.kind] - order[b.kind]);
  return { found: true, items, dateChecked };
}
