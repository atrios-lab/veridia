import { formatTaxId } from "../tax-id.ts";
import { type Act, actLabel, PARTY_ROLE_LABELS, situationOf } from "./acts.ts";
import { formatCnm } from "./cnm.ts";
import { LOCATIONS, STREET_KINDS } from "./codes.ts";
import { brDate, type PropertyInput, propertyTitle } from "./property.ts";

/**
 * The ficha of a matrícula as a document: the opening (the imóvel, the
 * owners, the registro anterior) and every lançamento in its order (Lei nº
 * 6.015/1973, arts. 176 and 231), with the CNM at the top right of every
 * page (CNN, art. 331). The same content feeds the PDF (to print or sign)
 * and the black-and-white TIFF image.
 */

export interface FichaBlock {
  /** "Abertura", "R-3-1.234"… */
  label: string;
  /** The date line under the label, when there is one. */
  meta: string;
  text: string;
}

export interface FichaContent {
  office: string;
  book: string;
  title: string;
  cnm: string;
  blocks: FichaBlock[];
  signer: { name: string; title: string } | null;
  place: string;
}

const people = (list: { name: string; document: string; share?: string }[]) =>
  list
    .map(
      (p) =>
        `${p.name}${p.document ? `, ${p.document.length === 14 ? "CNPJ" : "CPF"} ${formatTaxId(p.document)}` : ""}${p.share ? `, ${p.share}` : ""}`,
    )
    .join("; ");

/** The opening text when the ficha's own description is empty. */
function describe(p: PropertyInput): string {
  const kind =
    p.streetKind && p.streetKind !== 177 ? STREET_KINDS.get(p.streetKind) : "";
  const parts = [
    `Imóvel ${(LOCATIONS.get(p.location) ?? "").toLowerCase()}`,
    p.rural.denominacao ? `denominado ${p.rural.denominacao}` : "",
    [kind, p.street, p.streetNumber].filter(Boolean).join(" "),
    p.district,
    p.area ? `com a área de ${p.area}` : "",
    p.rural.ccir ? `CCIR ${p.rural.ccir}` : "",
    p.rural.nirf ? `NIRF ${p.rural.nirf}` : "",
    p.rural.car ? `CAR ${p.rural.car}` : "",
  ].filter(Boolean);
  return `${parts.join(", ")}.`;
}

export function fichaContent(input: {
  office: { name: string; city: string; state: string };
  property: PropertyInput;
  acts: (Act & { seal?: string })[];
  signer: { name: string; title: string } | null;
}): FichaContent {
  const p = input.property;
  const ordered = [...input.acts].sort((a, b) => a.seq - b.seq);
  const migration = ordered.find((a) => a.kind === "M");
  const opening: string[] = [];
  if (p.book === 3) {
    if (p.auxKind) opening.push(`Registro de ${p.auxKind}.`);
    if (p.linkedNumbers)
      opening.push(`Matrícula(s) vinculada(s): ${p.linkedNumbers}.`);
    if (p.description) opening.push(p.description);
  } else {
    opening.push(p.description || describe(p));
    if (migration) {
      const owners = situationOf([migration]).owners;
      if (owners.length) opening.push(`Proprietário(s): ${people(owners)}.`);
    }
    if (p.origin) opening.push(`Registro anterior: ${p.origin}.`);
  }
  const blocks: FichaBlock[] = [
    {
      label: p.book === 3 ? "Registro" : "Abertura",
      meta: p.openedOn ? `Aberta em ${brDate(p.openedOn)}` : "",
      text: opening.filter(Boolean).join("\n"),
    },
  ];
  for (const act of ordered) {
    if (act.kind === "M") continue;
    const byRole = new Map<string, typeof act.parties>();
    for (const party of act.parties) {
      byRole.set(party.role, [...(byRole.get(party.role) ?? []), party]);
    }
    const partiesLine = [...byRole]
      .map(
        ([role, list]) =>
          `${PARTY_ROLE_LABELS[role as keyof typeof PARTY_ROLE_LABELS]}: ${people(list)}`,
      )
      .join(". ");
    blocks.push({
      label: actLabel(act, p.number),
      meta: [
        act.registeredOn ? brDate(act.registeredOn) : "",
        act.nature,
        act.seal ? `Selo ${act.seal}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      text:
        act.summary ||
        [act.nature, partiesLine].filter(Boolean).join(". ").concat("."),
    });
  }
  return {
    office: input.office.name,
    book:
      p.book === 3 ? "Livro 3 · Registro Auxiliar" : "Livro 2 · Registro Geral",
    title: propertyTitle(p),
    cnm: p.cnm ? formatCnm(p.cnm) : "",
    blocks,
    signer: input.signer,
    place: `${input.office.city}/${input.office.state}`,
  };
}
