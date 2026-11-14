import {
  cleanText,
  isLivroCAuxiliar,
  matriculaDigits,
  type RcpnPerson,
  type RcpnRecord,
  toIsoDate,
} from "./record.ts";

/**
 * The Cartosoft (Access) model: which table and column of the office's
 * registry database is which field of the index. Read from the tables the
 * office exported (analysis of 14/11/2026: NA.mdb, CA.mdb, OB.mdb), and
 * nothing else of them: the reader passes only these columns on, so the
 * CPF, the documents and the cause of death never leave the file.
 */

export type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;

/** The tables the model reads, by kind. */
export const CARTOSOFT_TABLES = {
  nascimento: ["NASCIMENTO", "NA_PAIS"],
  casamento: ["CASAMENTO", "CA_PAIS", "CA_COMPLEMENTO"],
  obito: ["OBITO", "OB_PAIS"],
} as const;

/** The columns each table is read for: the rest stays in the file. */
export const CARTOSOFT_COLUMNS: Record<string, readonly string[]> = {
  NASCIMENTO: [
    "ID",
    "no_pessoa",
    "dt_nascimento",
    "nu_livro",
    "nu_folha",
    "cd_registro",
    "dt_registro",
    "nu_matriculaCNJ",
  ],
  NA_PAIS: ["ID", "NO_MAE", "NO_PAI", "no_profiss_pai", "no_profiss_mae"],
  CASAMENTO: [
    "nu_sequencia",
    "nu_registro",
    "nu_livro",
    "nu_folha",
    "no_noivo",
    "no_noiva",
    "no_noiva_casada",
    "dt_nasc_noivo",
    "dt_nasc_noiva",
    "profissao_noivo",
    "profissao_noiva",
    "dt_casamento",
    "nu_matriculaCNJ",
  ],
  CA_PAIS: [
    "nu_sequencia",
    "no_pai_noivo",
    "no_mae_noivo",
    "profiss_pai_noivo",
    "profiss_mae_noivo",
    "no_pai_noiva",
    "no_mae_noiva",
    "profiss_pai_noiva",
    "profiss_mae_noiva",
  ],
  CA_COMPLEMENTO: ["nu_sequencia", "no_noivo_casado"],
  OBITO: [
    "ID",
    "nu_registro",
    "nu_livro",
    "nu_folha",
    "no_pessoa",
    "dt_nascimento",
    "no_profissao",
    "dt_falecimento",
    "dt_cadastro",
    "nu_matriculaCNJ",
  ],
  OB_PAIS: ["ID", "no_pai", "no_mae", "profiss_pai", "profiss_mae"],
};

/** Whether these tables look like a Cartosoft export of the kind. */
export function hasCartosoftTables(tables: Tables, main: string): boolean {
  return Array.isArray(tables[main]);
}

function byKey(rows: Row[] | undefined, key: string): Map<string, Row> {
  const map = new Map<string, Row>();
  for (const row of rows ?? []) map.set(cleanText(row[key]), row);
  return map;
}

const t = (row: Row | undefined, column: string) => cleanText(row?.[column]);

function person(
  fields: Partial<RcpnPerson> & Pick<RcpnPerson, "role" | "name">,
): RcpnPerson {
  return {
    marriedName: "",
    motherName: "",
    fatherName: "",
    birthDate: "",
    profession: "",
    fatherProfession: "",
    motherProfession: "",
    ...fields,
  };
}

export function readCartosoft(tables: Tables): RcpnRecord[] {
  const records: RcpnRecord[] = [];

  if (hasCartosoftTables(tables, "NASCIMENTO")) {
    const parents = byKey(tables.NA_PAIS, "ID");
    for (const row of tables.NASCIMENTO ?? []) {
      const p = parents.get(cleanText(row.ID));
      records.push({
        kind: "nascimento",
        matricula: matriculaDigits(row.nu_matriculaCNJ),
        book: t(row, "nu_livro"),
        page: t(row, "nu_folha"),
        term: t(row, "cd_registro"),
        registeredOn: toIsoDate(row.dt_registro),
        eventOn: "",
        people: [
          person({
            role: "registrado",
            name: t(row, "no_pessoa"),
            motherName: t(p, "NO_MAE"),
            fatherName: t(p, "NO_PAI"),
            birthDate: toIsoDate(row.dt_nascimento),
            fatherProfession: t(p, "no_profiss_pai"),
            motherProfession: t(p, "no_profiss_mae"),
          }),
        ],
      });
    }
  }

  if (hasCartosoftTables(tables, "CASAMENTO")) {
    const parents = byKey(tables.CA_PAIS, "nu_sequencia");
    const extra = byKey(tables.CA_COMPLEMENTO, "nu_sequencia");
    for (const row of tables.CASAMENTO ?? []) {
      const key = cleanText(row.nu_sequencia);
      const p = parents.get(key);
      const c = extra.get(key);
      records.push({
        kind: "casamento",
        matricula: matriculaDigits(row.nu_matriculaCNJ),
        book: t(row, "nu_livro"),
        page: t(row, "nu_folha"),
        term: t(row, "nu_registro"),
        registeredOn: toIsoDate(row.dt_casamento),
        eventOn: toIsoDate(row.dt_casamento),
        people: [
          person({
            role: "conjuge1",
            name: t(row, "no_noivo"),
            marriedName: t(c, "no_noivo_casado"),
            motherName: t(p, "no_mae_noivo"),
            fatherName: t(p, "no_pai_noivo"),
            birthDate: toIsoDate(row.dt_nasc_noivo),
            profession: t(row, "profissao_noivo"),
            fatherProfession: t(p, "profiss_pai_noivo"),
            motherProfession: t(p, "profiss_mae_noivo"),
          }),
          person({
            role: "conjuge2",
            name: t(row, "no_noiva"),
            marriedName: t(row, "no_noiva_casada"),
            motherName: t(p, "no_mae_noiva"),
            fatherName: t(p, "no_pai_noiva"),
            birthDate: toIsoDate(row.dt_nasc_noiva),
            profession: t(row, "profissao_noiva"),
            fatherProfession: t(p, "profiss_pai_noiva"),
            motherProfession: t(p, "profiss_mae_noiva"),
          }),
        ],
      });
    }
  }

  if (hasCartosoftTables(tables, "OBITO")) {
    const parents = byKey(tables.OB_PAIS, "ID");
    for (const row of tables.OBITO ?? []) {
      const p = parents.get(cleanText(row.ID));
      records.push({
        kind: "obito",
        subtype: isLivroCAuxiliar(t(row, "nu_livro")) ? "natimorto" : "",
        matricula: matriculaDigits(row.nu_matriculaCNJ),
        book: t(row, "nu_livro"),
        page: t(row, "nu_folha"),
        term: t(row, "nu_registro"),
        registeredOn: toIsoDate(row.dt_cadastro),
        eventOn: toIsoDate(row.dt_falecimento),
        people: [
          person({
            role: "falecido",
            name: t(row, "no_pessoa"),
            motherName: t(p, "no_mae"),
            fatherName: t(p, "no_pai"),
            birthDate: toIsoDate(row.dt_nascimento),
            profession: t(row, "no_profissao"),
            fatherProfession: t(p, "profiss_pai"),
            motherProfession: t(p, "profiss_mae"),
          }),
        ],
      });
    }
  }

  return records;
}
