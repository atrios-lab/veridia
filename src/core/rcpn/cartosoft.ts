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
 * registry database is which field of the index and of the certidão.
 * Read from the tables the office exported (analysis of 14/11/2026:
 * NA.mdb, CA.mdb, OB.mdb). The office sends its whole registry ("o envio
 * das informações gerais, que já vai com os dados por livro, matrícula"),
 * and the panel keeps what the certidão prints, so it comes out ready
 * (decision of 14/11/2026). Only the listed columns leave the file: the
 * system's users, logs and the rest stay behind. The certidão fields map
 * to the columns the office's own Provimento 182 model names
 * (nascimento.ho_nascimento, na_avos.no_pai_mae, na_anoave.TEXTO...).
 */

export type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;

/** The tables the model reads, by kind. */
export const CARTOSOFT_TABLES = {
  nascimento: ["NASCIMENTO", "NA_PAIS", "NA_AVOS", "NA_ANOAVE", "NA_GEMEOS"],
  casamento: ["CASAMENTO", "CA_PAIS", "CA_COMPLEMENTO"],
  obito: ["OBITO", "OB_PAIS", "OB_DECLARANTE", "OB_RESUMO"],
} as const;

/** The columns each table is read for: the rest stays in the file. */
export const CARTOSOFT_COLUMNS: Record<string, readonly string[]> = {
  NASCIMENTO: [
    "ID",
    "no_pessoa",
    "dt_nascimento",
    "ho_nascimento",
    "nu_livro",
    "nu_folha",
    "cd_registro",
    "dt_registro",
    "nu_matriculaCNJ",
    "nu_dn",
    "cd_sexo",
    "cd_gemeo",
    "no_cidade",
    "no_estado",
    "no_local",
  ],
  NA_PAIS: [
    "ID",
    "NO_MAE",
    "NO_PAI",
    "no_profiss_pai",
    "no_profiss_mae",
    "no_natural_mae",
    "no_estado_mae",
    "no_natural_pai",
    "no_estado_pai",
  ],
  NA_AVOS: ["ID", "no_pai_pai", "no_mae_pai", "no_pai_mae", "no_mae_mae"],
  NA_ANOAVE: ["ID", "TEXTO"],
  NA_GEMEOS: ["ID", "no_irmao", "nu_matriculaCNJ"],
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
    "nacionalidade_noivo",
    "nacionalidade_noiva",
    "naturalidade_noivo",
    "naturalidade_noiva",
    "uf_natural_noivo",
    "uf_natural_noiva",
    "dt_casamento",
    "regime_casamento",
    "no_observacao",
    "no_observacao_2",
    "no_observacao_3",
    "no_observacao_4",
    "no_observacao_5",
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
    "hora_falecimento",
    "dt_cadastro",
    "nu_matriculaCNJ",
    "cd_sexo",
    "no_cor",
    "est_civil_pessoa",
    "idade_pessoa",
    "natural_pessoa",
    "est_natural_pessoa",
    "ender_pessoa",
    "cidade_res_pessoa",
    "estado_res_pessoa",
    "nu_rg",
    "orgao_emiss_rg",
    "uf_rg",
    "nu_cpf",
    "cd_eleitor",
    "local_falecimento",
    "no_cidade_fale",
    "uf_cidade_fale",
    "local_sepultamento",
    "uf_sepultamento",
    "no_medico",
    "nu_crm_medico",
    "obs",
  ],
  OB_PAIS: ["ID", "no_pai", "no_mae", "profiss_pai", "profiss_mae"],
  OB_DECLARANTE: ["ID", "no_declarante"],
  OB_RESUMO: ["ID", "obs1", "obs2", "obs3", "obs4", "obs5"],
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

/** A long text (anotações), its line breaks kept. */
const long = (row: Row | undefined, column: string) =>
  String(row?.[column] ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

/** "10:30" from an Access time (a Date on 30/12/1899) or a typed "10:30". */
export function timeOf(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const h = String(value.getUTCHours()).padStart(2, "0");
    const m = String(value.getUTCMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }
  const match = /(\d{1,2})\s*[:hH]\s*(\d{2})/.exec(cleanText(value));
  return match ? `${(match[1] ?? "").padStart(2, "0")}:${match[2]}` : "";
}

/** "M"/"F" (or the word) as the certidão writes it. */
export function sexOf(value: unknown): string {
  const text = cleanText(value).toUpperCase();
  if (text === "M" || text.startsWith("MASC")) return "MASCULINO";
  if (text === "F" || text.startsWith("FEM")) return "FEMININO";
  return cleanText(value);
}

const joined = (parts: string[], sep = ", ") => parts.filter(Boolean).join(sep);

/** Only the filled keys: a blank never erases what is known. */
function filled(details: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(details).filter(([, value]) => value.trim() !== ""),
  );
}

/** The day the naturalidade option began (Lei nº 13.484/2017). */
const NATURALIDADE_OPTION = "2017-09-26";

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
    const grandparents = byKey(tables.NA_AVOS, "ID");
    const notes = byKey(tables.NA_ANOAVE, "ID");
    const twins = new Map<string, Row[]>();
    for (const twin of tables.NA_GEMEOS ?? []) {
      const id = cleanText(twin.ID);
      twins.set(id, [...(twins.get(id) ?? []), twin]);
    }
    for (const row of tables.NASCIMENTO ?? []) {
      const id = cleanText(row.ID);
      const p = parents.get(id);
      const a = grandparents.get(id);
      const registeredOn = toIsoDate(row.dt_registro);
      const city = t(row, "no_cidade");
      const state = t(row, "no_estado");
      const hour = timeOf(row.ho_nascimento);
      const twinList = (twins.get(id) ?? [])
        .map((twin) =>
          joined([
            t(twin, "no_irmao"),
            matriculaDigits(twin.nu_matriculaCNJ) &&
              `matrícula ${matriculaDigits(twin.nu_matriculaCNJ)}`,
          ]),
        )
        .filter(Boolean);
      records.push({
        details: filled({
          hora: hour && `${hour} horas`,
          // Before the option of Lei nº 13.484/2017, the naturalidade was
          // the place of birth; after it, the declarant chose, so the book
          // says which and the person fills it.
          naturalidade:
            registeredOn && registeredOn < NATURALIDADE_OPTION ? city : "",
          naturalidadeUf:
            registeredOn && registeredOn < NATURALIDADE_OPTION ? state : "",
          localNascimento: t(row, "no_local"),
          municipioNascimento: city,
          municipioNascimentoUf: state,
          sexo: sexOf(row.cd_sexo),
          genitor1Municipio: t(p, "no_natural_mae"),
          genitor1Uf: t(p, "no_estado_mae"),
          avos1: joined([t(a, "no_pai_mae"), t(a, "no_mae_mae")], "; "),
          genitor2Municipio: t(p, "no_natural_pai"),
          genitor2Uf: t(p, "no_estado_pai"),
          avos2: joined([t(a, "no_pai_pai"), t(a, "no_mae_pai")], "; "),
          gemeo: twinList.join("; "),
          dnv: t(row, "nu_dn"),
          observacoes: long(notes.get(id), "TEXTO"),
        }),
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
      const spouse = (who: "noivo" | "noiva", name: string) =>
        joined([
          name,
          cleanText(row[`nacionalidade_${who}`]),
          toIsoDate(row[`dt_nasc_${who}`]) &&
            `nascido(a) em ${toIsoDate(row[`dt_nasc_${who}`]).split("-").reverse().join("/")}`,
          joined(
            [
              cleanText(row[`naturalidade_${who}`]),
              cleanText(row[`uf_natural_${who}`]),
            ],
            "/",
          ) &&
            `natural de ${joined([cleanText(row[`naturalidade_${who}`]), cleanText(row[`uf_natural_${who}`])], "/")}`,
          joined([t(p, `no_pai_${who}`), t(p, `no_mae_${who}`)], " e ") &&
            `filho(a) de ${joined([t(p, `no_pai_${who}`), t(p, `no_mae_${who}`)], " e ")}`,
        ]);
      records.push({
        details: filled({
          conjuges: [
            spouse("noivo", t(row, "no_noivo")),
            spouse("noiva", t(row, "no_noiva")),
          ]
            .filter(Boolean)
            .join("\n"),
          regime: t(row, "regime_casamento"),
          observacoes: [
            "no_observacao",
            "no_observacao_2",
            "no_observacao_3",
            "no_observacao_4",
            "no_observacao_5",
          ]
            .map((column) => t(row, column))
            .filter(Boolean)
            .join("\n"),
        }),
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
    const declarants = byKey(tables.OB_DECLARANTE, "ID");
    const summaries = byKey(tables.OB_RESUMO, "ID");
    for (const row of tables.OBITO ?? []) {
      const id = cleanText(row.ID);
      const p = parents.get(id);
      const hour = timeOf(row.hora_falecimento);
      const voter = t(row, "cd_eleitor").toUpperCase();
      const summary = summaries.get(id);
      records.push({
        details: filled({
          sexo: sexOf(row.cd_sexo),
          cor: t(row, "no_cor"),
          estadoCivilIdade: joined([
            t(row, "est_civil_pessoa"),
            t(row, "idade_pessoa") && `${t(row, "idade_pessoa")} anos`,
          ]),
          naturalidade: joined(
            [t(row, "natural_pessoa"), t(row, "est_natural_pessoa")],
            "/",
          ),
          documento: joined(
            [
              t(row, "nu_rg") &&
                `RG ${joined([t(row, "nu_rg"), joined([t(row, "orgao_emiss_rg"), t(row, "uf_rg")], "/")], " ")}`,
              t(row, "nu_cpf") && `CPF ${t(row, "nu_cpf")}`,
            ],
            "; ",
          ),
          eleitor: voter === "S" ? "SIM" : voter === "N" ? "NÃO" : voter,
          filiacaoResidencia: joined(
            [
              joined([t(p, "no_pai"), t(p, "no_mae")], " e "),
              joined([
                t(row, "ender_pessoa"),
                joined(
                  [t(row, "cidade_res_pessoa"), t(row, "estado_res_pessoa")],
                  "/",
                ),
              ]),
            ],
            "\n",
          ),
          // Not a certidão field: the prefill writes the date in words
          // with it (core/rcpn/certidao.ts).
          horaFalecimento: hour,
          localFalecimento: joined([
            t(row, "local_falecimento"),
            joined([t(row, "no_cidade_fale"), t(row, "uf_cidade_fale")], "/"),
          ]),
          sepultamento: joined(
            [t(row, "local_sepultamento"), t(row, "uf_sepultamento")],
            "/",
          ),
          declarante: t(declarants.get(id), "no_declarante"),
          medico: joined([
            t(row, "no_medico"),
            t(row, "nu_crm_medico") && `CRM ${t(row, "nu_crm_medico")}`,
          ]),
          observacoes: [
            long(row, "obs"),
            ...["obs1", "obs2", "obs3", "obs4", "obs5"].map((c) =>
              long(summary, c),
            ),
          ]
            .filter(Boolean)
            .join("\n"),
        }),
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
