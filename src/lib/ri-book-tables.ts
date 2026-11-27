import { actLabel } from "@/core/ri/acts.ts";
import type { ProtocolLine } from "@/core/ri/books.ts";
import { formatCnm } from "@/core/ri/cnm.ts";
import { CNM_SITUATIONS } from "@/core/ri/codes.ts";
import { addressLine, propertyTitle } from "@/core/ri/property.ts";
import { formatTaxId } from "@/core/tax-id.ts";
import type { Acervo } from "./ri.ts";

/**
 * Each book as a table, in the columns of the models of the Provimento nº
 * 223/2020 da CGJ/RN (Livros 4 and 5: Nº de ordem, Identificação do imóvel
 * or Pessoas, Referência aos demais livros, Anotações) and of the arts. 175
 * (Livro 1) and 176 (Livros 2 and 3) of the Lei nº 6.015/1973. The same rows
 * go to the PDF of the book and to the spreadsheet the office exports
 * (decision of 27/11/2026: imprimir, gerar relatório, exportar a tabela).
 */
export interface BookTable {
  columns: string[];
  rows: string[][];
}

const n = (value: number) => value.toLocaleString("pt-BR");

const shortIso = (iso: string | null | undefined) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};

/** Livro 1: the columns of the art. 175, in the order apontados. */
export function protocolTable(lines: ProtocolLine[]): BookTable {
  return {
    columns: [
      "Nº de ordem",
      "Data",
      "Apresentante",
      "Natureza do título",
      "Atos (anotações)",
    ],
    rows: [...lines]
      .sort((a, b) => a.number - b.number)
      .map((l) => [
        n(l.number),
        shortIso(l.presentedOn),
        l.presenter,
        l.titleKind,
        l.voided ? "Lançado por engano (anulado)" : l.acts,
      ]),
  };
}

/** Livros 2 and 3: one line per matrícula or registro. */
export function registryTable(acervo: Acervo, book: 2 | 3): BookTable {
  return {
    columns: [
      book === 2 ? "Matrícula nº" : "Registro nº",
      "Identificação",
      "CNM",
      "Atos",
      "Situação",
    ],
    rows: acervo.properties
      .filter((p) => !p.deletedAt && p.book === book)
      .sort((a, b) => a.number - b.number)
      .map((p) => [
        n(p.number),
        book === 2
          ? [propertyTitle(p), addressLine(p)].filter(Boolean).join(" · ")
          : propertyTitle(p),
        p.cnm ? formatCnm(p.cnm) : "",
        (acervo.acts.get(p.id) ?? []).map((a) => actLabel(a)).join(", "),
        CNM_SITUATIONS.get(p.status) ?? "",
      ]),
  };
}

/** Livro 4, Indicador Real (art. 179), in the model of the Prov. 223/2020. */
export function realIndicatorTable(acervo: Acervo): BookTable {
  const rows = acervo.properties
    .filter((p) => !p.deletedAt && p.book === 2 && p.status !== 4)
    .sort((a, b) => addressLine(a).localeCompare(addressLine(b), "pt-BR"))
    .map((p, i) => {
      const identification = [
        addressLine(p),
        p.rural.denominacao,
        p.rural.ccir && `CCIR ${p.rural.ccir}`,
        p.rural.nirf && `NIRF ${p.rural.nirf}`,
        p.rural.car && `CAR ${p.rural.car}`,
        p.rural.incra && `Incra ${p.rural.incra}`,
      ]
        .filter(Boolean)
        .join(" · ");
      const acts = (acervo.acts.get(p.id) ?? []).map((a) => actLabel(a));
      const notes = [
        p.cnm && `CNM ${formatCnm(p.cnm)}`,
        p.status ? (CNM_SITUATIONS.get(p.status) ?? "") : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return [
        n(i + 1),
        identification || "sem identificação lançada",
        [`Livro 2, matrícula nº ${n(p.number)}`, acts.join(", ")]
          .filter(Boolean)
          .join(": "),
        notes,
      ];
    });
  return {
    columns: [
      "Nº de ordem",
      "Identificação do imóvel",
      "Referência aos demais livros",
      "Anotações",
    ],
    rows,
  };
}

/** Livro 5, Indicador Pessoal (art. 180), alphabetical, Prov. 223/2020. */
export function personalIndicatorTable(acervo: Acervo): BookTable {
  const people = new Map<
    string,
    { name: string; refs: Set<string>; roles: Set<string> }
  >();
  const add = (name: string, document: string, ref: string, role = "") => {
    if (!name.trim()) return;
    const key = document || name.trim().toUpperCase();
    const entry = people.get(key) ?? {
      name: document ? `${name}, ${formatTaxId(document)}` : name,
      refs: new Set<string>(),
      roles: new Set<string>(),
    };
    entry.refs.add(ref);
    if (role) entry.roles.add(role);
    people.set(key, entry);
  };
  for (const p of acervo.properties) {
    if (p.deletedAt) continue;
    const where =
      p.book === 3
        ? `Livro 3, registro nº ${n(p.number)}`
        : `Livro 2, matrícula nº ${n(p.number)}`;
    if (p.book === 3) {
      for (const party of p.aux.parties) add(party.name, party.document, where);
    }
    for (const act of acervo.acts.get(p.id) ?? []) {
      for (const party of act.parties) {
        add(party.name, party.document, `${where} (${actLabel(act)})`);
      }
    }
  }
  const rows = [...people.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .map((e, i) => [n(i + 1), e.name, [...e.refs].join("; "), ""]);
  return {
    columns: [
      "Nº de ordem",
      "Pessoas",
      "Referência aos demais livros",
      "Anotações",
    ],
    rows,
  };
}
