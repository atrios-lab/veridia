import {
  cleanText,
  matriculaDigits,
  type RcpnRecord,
  toIsoDate,
} from "./record.ts";

/**
 * The XML carga (`CARGAREGISTROS`, analysis of 14/11/2026): the file the
 * registry system generates for each new registro, like
 * `NA_INC_20250902_1.xml`. Read from its parsed tree, so the parser stays
 * outside the core. Only nascimento is known so far; the casamento and óbito
 * movements are recognised and reported, never guessed.
 *
 * The carga has no profession: those fields stay blank, and the public
 * answer already says "not in the digital data" for a blank one.
 */

type Node = Record<string, unknown>;

const asList = (value: unknown): Node[] =>
  Array.isArray(value)
    ? (value as Node[])
    : value && typeof value === "object"
      ? [value as Node]
      : [];

const text = (node: Node | undefined, key: string) => cleanText(node?.[key]);

function isFemale(sex: string): boolean {
  return /^F/i.test(sex);
}

export interface CargaReading {
  records: RcpnRecord[];
  /** Movements the reader does not know yet, by tag. */
  unknownMovements: string[];
}

export function isCargaXml(tree: unknown): boolean {
  return Boolean(
    tree && typeof tree === "object" && "CARGAREGISTROS" in (tree as Node),
  );
}

export function readCargaXml(tree: unknown): CargaReading {
  const root = (tree as Node | undefined)?.CARGAREGISTROS as Node | undefined;
  const records: RcpnRecord[] = [];
  const unknownMovements: string[] = [];
  if (!root) return { records, unknownMovements };

  for (const [tag, value] of Object.entries(root)) {
    if (!tag.startsWith("MOVIMENTO")) continue;
    if (!tag.startsWith("MOVIMENTONASCIMENTO")) {
      unknownMovements.push(tag);
      continue;
    }
    for (const movement of asList(value)) {
      for (const [inner, registros] of Object.entries(movement)) {
        if (!inner.startsWith("REGISTRONASCIMENTO")) continue;
        for (const r of asList(registros)) {
          const parents = asList(r.FILIACAONASCIMENTO);
          // The carga lists the parents with their sex, not as "mother" and
          // "father": the first woman is read as the mother and the other
          // parent as the second filiação, whatever the sex.
          const motherIndex = parents.findIndex((p) =>
            isFemale(text(p, "SEXO")),
          );
          const mother = motherIndex >= 0 ? parents[motherIndex] : undefined;
          const other = parents.find((_, i) => i !== motherIndex);
          records.push({
            kind: "nascimento",
            matricula: matriculaDigits(r.MATRICULA),
            book: "",
            page: "",
            term: text(r, "INDICEREGISTRO"),
            registeredOn: toIsoDate(r.DATAREGISTRO),
            eventOn: "",
            people: [
              {
                role: "registrado",
                name: text(r, "NOMEREGISTRADO"),
                marriedName: "",
                motherName: text(mother, "NOME"),
                fatherName: text(other, "NOME"),
                birthDate: toIsoDate(r.DATANASCIMENTO),
                profession: "",
                fatherProfession: "",
                motherProfession: "",
              },
            ],
          });
        }
      }
    }
  }
  return { records, unknownMovements };
}
