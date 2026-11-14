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
  nascimento: [
    "NASCIMENTO",
    "NA_PAIS",
    "NA_AVOS",
    "NA_ANOAVE",
    "NA_GEMEOS",
    "NA_DECLARANTE",
    "NA_TESTEMUNHA",
  ],
  casamento: ["CASAMENTO", "CA_PAIS", "CA_COMPLEMENTO", "CA_TESTEMUNHAS"],
  obito: [
    "OBITO",
    "OB_PAIS",
    "OB_DECLARANTE",
    "OB_RESUMO",
    "OB_ELEITOR",
    "OB_MOTIVO_MORTE",
  ],
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
    "no_pais",
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
    "dt_nasci_mae",
    "dt_nasci_pai",
    "nu_idade_mae",
    "nu_idade_pai",
    "no_nac_mae",
    "no_nac_pai",
    "no_ender_mae",
    "no_cidade_ender_mae",
    "no_uf_ender_mae",
    "no_ender_pai",
    "no_cidade_ender_pai",
    "no_uf_ender_pai",
    "IDEN_MAE",
    "IDEN_PAI",
  ],
  NA_DECLARANTE: [
    "ID",
    "NO_NOME",
    "nu_docto",
    "no_profissao",
    "no_endereco",
    "no_cidade",
    "cd_uf",
  ],
  NA_TESTEMUNHA: [
    "ID",
    "qualif_testemunhas",
    "compl_qualif_testemunhas",
    "nome_1",
    "documento_1",
    "no_profiss_1",
    "profissao_1",
    "ender_1",
    "nome_2",
    "documento_2",
    "no_profiss_2",
    "profissao_2",
    "ender_2",
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
    "no_obs",
    "nu_matriculaCNJ",
    "estcivil_noivo",
    "estcivil_noiva",
    "endereco_noivo",
    "endereco_noiva",
    "cidade_res_noivo",
    "estado_res_noivo",
    "cidade_res_noiva",
    "estado_res_noiva",
    "nu_docto_noivo",
    "nu_docto_noiva",
    "ho_casamento",
    "no_juiz_paz",
    "local_casamento",
    "nu_processo",
    "nu_edital",
    "dt_edital",
    "dt_habilitacao",
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
  CA_TESTEMUNHAS: [
    "nu_sequencia",
    "qualif_testemunhas",
    "compl_qualif_testemunhas",
    "no_testemunha1",
    "nu_documento1",
    "profissao1",
    "endereco1",
    "no_testemunha2",
    "nu_documento2",
    "profissao2",
    "endereco2",
  ],
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
    "no_conjuge",
    "nu_benef_INSS",
    "deixou_filhos",
    "no_teste1",
    "nu_doc_teste1",
    "no_teste2",
    "nu_doc_teste2",
  ],
  OB_PAIS: ["ID", "no_pai", "no_mae", "profiss_pai", "profiss_mae"],
  OB_DECLARANTE: ["ID", "no_declarante", "nu_documento", "profissao", "ender"],
  OB_RESUMO: ["ID", "obs1", "obs2", "obs3", "obs4", "obs5"],
  OB_ELEITOR: ["ID", "nu_tit_eleitoral", "nu_zona", "nu_secao"],
  OB_MOTIVO_MORTE: [
    "ID",
    "causa_morte1",
    "causa_morte2",
    "causa_morte3",
    "causa_morte4",
    "causa_morte5",
    "causa_morte6",
  ],
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

/**
 * "M"/"F" (or the word) as the certidão writes it. A numeric code (the
 * nascimento table writes 0 and 1) is not read: its meaning is not in
 * the file, and a guess would print the wrong sex.
 */
export function sexOf(value: unknown): string {
  const text = cleanText(value).toUpperCase();
  if (text === "M" || text.startsWith("MASC")) return "MASCULINO";
  if (text === "F" || text.startsWith("FEM")) return "FEMININO";
  return wordOf(value);
}

/**
 * A text column that some versions fill with a numeric code (cor,
 * estado civil, nacionalidade): only words are read; a number, a "-1" or a
 * bracket left by the system is not printed.
 */
export function wordOf(value: unknown): string {
  const text = cleanText(value).replace(/^\[+/, "").trim();
  return /\p{L}/u.test(text) ? text : "";
}

/** An age column: "0" is "not informed", not a newborn parent. */
function yearsOf(value: unknown): string {
  const n = Number(cleanText(value));
  return Number.isInteger(n) && n > 0 && n < 130 ? `${n} anos` : "";
}

/** "S"/"N" or the word; a numeric code is not read (see `wordOf`). */
function yesNo(value: unknown): string {
  const text = cleanText(value).toUpperCase();
  if (text === "S" || text === "SIM") return "SIM";
  if (text === "N" || text === "NAO" || text === "NÃO") return "NÃO";
  return "";
}

/** The witnesses as the book writes them, in one text (both tables). */
function witnessText(row: Row | undefined): string {
  return [
    long(row, "qualif_testemunhas"),
    long(row, "compl_qualif_testemunhas"),
  ]
    .filter((text) => wordOf(text))
    .join("\n");
}

/** "Fulano, RG 123, pedreiro, Rua X": the parts the book gives. */
function qualification(parts: string[]): string {
  return parts.filter(Boolean).join(", ");
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
    const declarants = byKey(tables.NA_DECLARANTE, "ID");
    const witnessRows = byKey(tables.NA_TESTEMUNHA, "ID");
    const twins = new Map<string, Row[]>();
    for (const twin of tables.NA_GEMEOS ?? []) {
      const id = cleanText(twin.ID);
      twins.set(id, [...(twins.get(id) ?? []), twin]);
    }
    for (const row of tables.NASCIMENTO ?? []) {
      const id = cleanText(row.ID);
      const p = parents.get(id);
      const a = grandparents.get(id);
      const dec = declarants.get(id);
      const w = witnessRows.get(id);
      const witness = (n: 1 | 2) => ({
        [`testemunha${n}`]: t(w, `nome_${n}`),
        [`testemunha${n}Qualificacao`]: t(w, `nome_${n}`)
          ? qualification([
              t(w, `documento_${n}`) && `documento ${t(w, `documento_${n}`)}`,
              wordOf(w?.[`no_profiss_${n}`]) || wordOf(w?.[`profissao_${n}`]),
              t(w, `ender_${n}`),
            ])
          : "",
      });
      const parent = (n: 1 | 2, who: "mae" | "pai") => ({
        [`genitor${n}Nascimento`]: toIsoDate(p?.[`dt_nasci_${who}`]),
        [`genitor${n}Idade`]: yearsOf(p?.[`nu_idade_${who}`]),
        [`genitor${n}Nacionalidade`]: wordOf(
          p?.[`no_nac_${who}`],
        ).toUpperCase(),
        [`genitor${n}Endereco`]: joined([
          t(p, `no_ender_${who}`),
          joined(
            [t(p, `no_cidade_ender_${who}`), t(p, `no_uf_ender_${who}`)],
            "/",
          ),
        ]),
        [`genitor${n}Documento`]: t(p, who === "mae" ? "IDEN_MAE" : "IDEN_PAI"),
      });
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
          nacionalidade: /^brasil/i.test(t(row, "no_pais")) ? "BRASILEIRA" : "",
          ...parent(1, "mae"),
          ...parent(2, "pai"),
          declarante: t(dec, "NO_NOME"),
          declaranteQualificacao: t(dec, "NO_NOME")
            ? qualification([
                t(dec, "nu_docto") && `documento ${t(dec, "nu_docto")}`,
                wordOf(dec?.no_profissao),
                joined([
                  t(dec, "no_endereco"),
                  joined([t(dec, "no_cidade"), t(dec, "cd_uf")], "/"),
                ]),
              ])
            : "",
          ...witness(1),
          ...witness(2),
          testemunhas: witnessText(w),
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
    const witnessRows = byKey(tables.CA_TESTEMUNHAS, "nu_sequencia");
    for (const row of tables.CASAMENTO ?? []) {
      const key = cleanText(row.nu_sequencia);
      const p = parents.get(key);
      const c = extra.get(key);
      const w = witnessRows.get(key);
      const witness = (n: 1 | 2) => ({
        [`testemunha${n}`]: t(w, `no_testemunha${n}`),
        [`testemunha${n}Qualificacao`]: t(w, `no_testemunha${n}`)
          ? qualification([
              t(w, `nu_documento${n}`) &&
                `documento ${t(w, `nu_documento${n}`)}`,
              wordOf(w?.[`profissao${n}`]),
              t(w, `endereco${n}`),
            ])
          : "",
      });
      const spouseDetails = (n: 1 | 2, who: "noivo" | "noiva") => ({
        [`conjuge${n}EstadoCivil`]: wordOf(row[`estcivil_${who}`]),
        [`conjuge${n}Nacionalidade`]: wordOf(
          row[`nacionalidade_${who}`],
        ).toUpperCase(),
        [`conjuge${n}Naturalidade`]: joined(
          [t(row, `naturalidade_${who}`), t(row, `uf_natural_${who}`)],
          "/",
        ),
        [`conjuge${n}Documento`]: t(row, `nu_docto_${who}`),
        [`conjuge${n}Endereco`]: joined([
          t(row, `endereco_${who}`),
          joined(
            [t(row, `cidade_res_${who}`), t(row, `estado_res_${who}`)],
            "/",
          ),
        ]),
      });
      const weddingHour = timeOf(row.ho_casamento);
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
          horaCasamento: weddingHour && `${weddingHour} horas`,
          juiz: t(row, "no_juiz_paz"),
          localCasamento: wordOf(row.local_casamento),
          habilitacao: t(row, "nu_processo"),
          edital: joined(
            [
              t(row, "nu_edital") && `nº ${t(row, "nu_edital")}`,
              toIsoDate(row.dt_edital) &&
                `de ${toIsoDate(row.dt_edital).split("-").reverse().join("/")}`,
            ],
            " ",
          ),
          dataHabilitacao: toIsoDate(row.dt_habilitacao),
          ...spouseDetails(1, "noivo"),
          ...spouseDetails(2, "noiva"),
          ...witness(1),
          ...witness(2),
          testemunhas: witnessText(w),
          observacoes: [
            "no_observacao",
            "no_observacao_2",
            "no_observacao_3",
            "no_observacao_4",
            "no_observacao_5",
          ]
            .map((column) => t(row, column))
            .concat(long(row, "no_obs"))
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
    const voters = byKey(tables.OB_ELEITOR, "ID");
    const causes = byKey(tables.OB_MOTIVO_MORTE, "ID");
    for (const row of tables.OBITO ?? []) {
      const id = cleanText(row.ID);
      const p = parents.get(id);
      const hour = timeOf(row.hora_falecimento);
      const summary = summaries.get(id);
      const dec = declarants.get(id);
      const v = voters.get(id);
      const cause = causes.get(id);
      const witness = (n: 1 | 2) => ({
        [`testemunha${n}`]: t(row, `no_teste${n}`),
        [`testemunha${n}Qualificacao`]:
          t(row, `nu_doc_teste${n}`) &&
          `documento ${t(row, `nu_doc_teste${n}`)}`,
      });
      records.push({
        details: filled({
          sexo: sexOf(row.cd_sexo),
          cor: wordOf(row.no_cor).toUpperCase(),
          estadoCivilIdade: joined([
            wordOf(row.est_civil_pessoa),
            yearsOf(row.idade_pessoa),
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
          eleitor: yesNo(row.cd_eleitor),
          tituloEleitor: joined([
            t(v, "nu_tit_eleitoral") && `título ${t(v, "nu_tit_eleitoral")}`,
            t(v, "nu_zona") && `zona ${t(v, "nu_zona")}`,
            t(v, "nu_secao") && `seção ${t(v, "nu_secao")}`,
          ]),
          conjuge: t(row, "no_conjuge"),
          beneficio: t(row, "nu_benef_INSS"),
          filhos: wordOf(row.deixou_filhos) ? long(row, "deixou_filhos") : "",
          endereco: joined([
            t(row, "ender_pessoa"),
            joined(
              [t(row, "cidade_res_pessoa"), t(row, "estado_res_pessoa")],
              "/",
            ),
          ]),
          causaMorte: [1, 2, 3, 4, 5, 6]
            .map((n) => t(cause, `causa_morte${n}`))
            .filter(Boolean)
            .join("; "),
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
          declarante: t(dec, "no_declarante"),
          declaranteQualificacao: t(dec, "no_declarante")
            ? qualification([
                t(dec, "nu_documento") && `documento ${t(dec, "nu_documento")}`,
                wordOf(dec?.profissao),
                t(dec, "ender"),
              ])
            : "",
          ...witness(1),
          ...witness(2),
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
