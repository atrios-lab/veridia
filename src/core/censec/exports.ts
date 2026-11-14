import {
  CEP_DOCUMENTS,
  CEP_KINDS,
  CEP_NATURES,
  CEP_QUALITIES,
  CEP_REFERENCE_KINDS,
  CESDI_COUPLE_KINDS,
  CESDI_DOCUMENTS,
  CESDI_KINDS,
  CESDI_QUALITIES,
  type CensecAct,
  type CensecParty,
  type Central,
  CUSTODY,
  codeOf,
  LITIGATIONS,
  PAYMENT_FORMS,
  PAYMENT_TERMS,
  RCTO_DOCUMENTS,
  RCTO_KINDS,
  REGIMES,
  USUCAPIAO_NATURES,
} from "./censec.ts";

/**
 * The files of the CENSEC's loads (decision of 14/11/2026: "carregadas
 * por quinzena em XML, Texto e Json"), each one as the CNB/CF publishes it
 * (consulted on 14/11/2026):
 *
 * - JSON, the recommended one ("JSON CENSEC (recomendado!)"): the body of
 *   /api/cargas/upload-json (Swagger, Cargas.UploadCargaRequest), the CNS
 *   and the quinzena, then atosCep, atosCesdi and testamentos; one file
 *   takes the three centrals and the CENSEC splits it;
 * - XML ("XML CENSEC (não recomendável)"): one root per central, one row
 *   per party (CEP, CESDI) or per testamento (RCTO), numeric codes, as the
 *   CNB/CF's example files;
 * - TXT ("TXT CENSEC"): UTF-8 without BOM, a header line with the field
 *   names, every field between double quotes and separated by ";", dates
 *   as DD/MM/AAAA, one line per party; the CNB/CF publishes the columns of
 *   the CESDI and the RCTO, so the CEP goes by JSON or XML.
 *
 * Only what the act has goes in: an empty field is left out of the JSON.
 */

export interface CensecOffice {
  cns?: string;
}

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

const digits = (value: string) => value.replace(/\D/g, "");
const cnsNumber = (cns: string | undefined) => Number(digits(cns ?? "")) || 0;
const money = (cents: number | null) =>
  cents === null ? undefined : Number((cents / 100).toFixed(2));
const text = (value: string) => value.trim() || undefined;

/** Drops undefined, null and empty strings. */
function compact<T extends Record<string, unknown>>(object: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(object).filter(
      ([, v]) => v !== undefined && v !== null && v !== "",
    ),
  ) as Partial<T>;
}

export function quinzenaModel(quinzena: string) {
  const [year, month, half] = quinzena.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  return {
    anoReferencia: year,
    quinzenaReferencia: half,
    mesReferencia: MONTHS[month - 1] ?? "Janeiro",
  };
}

const yesNo = (value: "" | "sim" | "nao") =>
  value === "sim" ? true : value === "nao" ? false : undefined;

// ---------------------------------------------------------------- JSON

function cepParty(p: CensecParty) {
  return compact({
    nome: p.name.trim(),
    qualidade: p.quality,
    tipoDocumento: p.docType || "Desconhecido",
    numeroDocumento:
      p.docType === "Cpf" || p.docType === "Cnpj"
        ? digits(p.docNumber)
        : text(p.docNumber),
    identidade: text(p.identity),
    orgaoEmissor: text(p.issuer),
    estrangeiro: p.foreign,
  });
}

function cepAct(act: CensecAct) {
  const escritura = act.kind === "Escritura";
  const usucapiao = act.kind === "AtaNotarialDeUsucapiao";
  const assets = act.assets.map((a) =>
    compact({
      descricaoPormenorizada: text(a.description),
      valorBemEDireito: money(a.valueCents),
      valorFiscal: money(a.fiscalCents),
      formaPagamento: a.paymentForm || undefined,
      prazoPagamento: a.paymentTerm || undefined,
      matricula: text(a.matricula),
      codigoNacionalMatricula: text(a.cnm),
    }),
  );
  return compact({
    tipoAtoCep: act.kind,
    naturezaEscritura: escritura ? act.nature : undefined,
    naturezaAtaNotarialDeUsucapiao: usucapiao ? act.nature : undefined,
    mne: act.mne ? digits(act.mne) : undefined,
    data: act.date,
    livro: act.book,
    livroComplemento: text(act.bookSuffix),
    folha: act.page,
    folhaComplemento: text(act.pageSuffix),
    valor: money(act.valueCents),
    regimeBens: act.regime || undefined,
    dataContrato: act.contractDate || undefined,
    dataValidade: act.validity || undefined,
    comReservaDePoderes:
      act.kind === "Substabelecimento" ? yesNo(act.reserve) : undefined,
    naturezaLitigio: act.litigation || undefined,
    acordo: yesNo(act.agreement),
    complementacao: text(act.complement),
    existeBemEDireito: assets.length > 0 ? true : undefined,
    bensEDireitos: assets.length > 0 ? assets : undefined,
    referentes:
      act.references.length > 0
        ? act.references.map((r) =>
            compact({
              tipoAtoCep: r.kind || undefined,
              cns: digits(r.cns) ? Number(digits(r.cns)) : undefined,
              livro: digits(r.book) || undefined,
              livroComplemento: text(r.bookSuffix),
              folha: digits(r.page) || undefined,
              folhaComplemento: text(r.pageSuffix),
              referentePais: text(r.country),
            }),
          )
        : undefined,
    partes: act.parties.map(cepParty),
  });
}

function cesdiParty(act: CensecAct, p: CensecParty) {
  const couple = CESDI_COUPLE_KINDS.has(act.kind) && p.quality !== "Advogado";
  // The CPF is always the primary document (the CESDI's specification).
  const documents = [
    p.docType &&
      compact({
        documentoTipo: p.docType,
        prioridade: "Primario",
        documento:
          p.docType === "Cpf" || p.docType === "Cnpj"
            ? digits(p.docNumber)
            : text(p.docNumber),
      }),
    p.oab &&
      compact({
        documentoTipo: "Oab",
        prioridade: p.docType ? "Secundario" : "Primario",
        documento: p.oab,
        uf: p.oabUf || undefined,
      }),
    p.identity &&
      compact({
        documentoTipo: "Rg",
        prioridade: p.docType || p.oab ? "Secundario" : "Primario",
        documento: p.identity.trim(),
      }),
  ].filter(Boolean);
  return compact({
    nome: p.name.trim(),
    qualidade: p.quality,
    conjugeTipo: couple ? p.spouse || undefined : undefined,
    dataNascimento: couple ? p.birthDate || undefined : undefined,
    localNascimentoPais: couple ? text(p.birthCountry) : undefined,
    localNascimentoUf: couple ? p.birthUf || undefined : undefined,
    localResidenciaPais: couple ? text(p.residenceCountry) : undefined,
    localResidenciaMunicipio: couple ? text(p.residenceCity) : undefined,
    localResidenciaUf: couple ? p.residenceUf || undefined : undefined,
    sexo: couple ? p.sex || undefined : undefined,
    estrangeiro: p.foreign,
    documentos: documents,
  });
}

function cesdiAct(act: CensecAct) {
  const couple = CESDI_COUPLE_KINDS.has(act.kind);
  const assets = act.assets.map((a) =>
    compact({
      descricaoPormenorizada: text(a.description),
      valorBemEDireito: money(a.valueCents),
      valorFiscal: money(a.fiscalCents),
      formaPagamento: a.paymentForm || undefined,
      prazoPagamento: a.paymentTerm || undefined,
    }),
  );
  const count = (value: string) =>
    /^\d{1,2}$/.test(value.trim()) ? Number(value.trim()) : undefined;
  return compact({
    tipoAtoCesdi: act.kind,
    mne: act.mne ? digits(act.mne) : undefined,
    data: act.date,
    livro: act.book,
    livroComplemento: text(act.bookSuffix),
    folha: act.page,
    folhaComplemento: text(act.pageSuffix),
    dataCasamento: couple ? act.marriageDate || undefined : undefined,
    regimeBens: couple ? act.regime || undefined : undefined,
    quantidadeFilhosMaiores: couple ? count(act.adultChildren) : undefined,
    quantidadeFilhosMenores: couple ? count(act.minorChildren) : undefined,
    responsavel: couple ? act.custody || undefined : undefined,
    existeBemEDireito: assets.length > 0 ? true : undefined,
    bensEDireitos: assets.length > 0 ? assets : undefined,
    referentes:
      act.references.length > 0
        ? act.references.map((r) =>
            compact({
              tipoAtoCesdi: r.kind || undefined,
              cns: digits(r.cns) ? Number(digits(r.cns)) : undefined,
              livro: digits(r.book) || undefined,
              livroComplemento: text(r.bookSuffix),
              folha: digits(r.page) || undefined,
              folhaComplemento: text(r.pageSuffix),
            }),
          )
        : undefined,
    partes: act.parties.map((p) => cesdiParty(act, p)),
  });
}

function rctoAct(act: CensecAct) {
  const t = act.testator;
  const r = act.revocation;
  const revocation =
    act.kind === "Revogacao" || act.kind === "TestamentoComRevogacao";
  return compact({
    tipoTestamento: act.kind,
    mne: act.mne ? digits(act.mne) : undefined,
    cpf: digits(t.cpf),
    nome: t.name.trim(),
    dataNascimento: t.birthDate,
    nomeMae: text(t.mother),
    nomePai: text(t.father),
    dataTestamento: act.date,
    livro: act.book,
    livroComplemento: text(act.bookSuffix),
    folha: act.page,
    folhaComplemento: text(act.pageSuffix),
    tipoDocumento: t.docType || undefined,
    documento: t.docType ? text(t.doc) : undefined,
    documentoComplemento: t.docType ? text(t.docComplement) : undefined,
    observacoes: text(act.observations),
    revogacaoCartorioCns:
      revocation && digits(r.cns) ? Number(digits(r.cns)) : undefined,
    revogacaoDataTestamento: revocation ? r.date || undefined : undefined,
    revogacaoLivro: revocation ? digits(r.book) || undefined : undefined,
    revogacaoLivroComplemento: revocation ? text(r.bookSuffix) : undefined,
    revogacaoFolha: revocation ? digits(r.page) || undefined : undefined,
    revogacaoFolhaComplemento: revocation ? text(r.pageSuffix) : undefined,
    desconhecidoOutros: revocation ? text(r.unknown) : undefined,
  });
}

/**
 * The JSON of the quinzena: the three centrals in one request, or only
 * the one asked. A central with no act has no list.
 */
export function censecObject(
  office: CensecOffice,
  quinzena: string,
  acts: CensecAct[],
  only?: Central,
) {
  const of = (central: Central) =>
    only && only !== central ? [] : acts.filter((a) => a.central === central);
  const cep = of("cep");
  const cesdi = of("cesdi");
  const rcto = of("rcto");
  return compact({
    cns: cnsNumber(office.cns),
    quinzena: quinzenaModel(quinzena),
    atosCep: cep.length ? cep.map(cepAct) : undefined,
    atosCesdi: cesdi.length ? cesdi.map(cesdiAct) : undefined,
    testamentos: rcto.length ? rcto.map(rctoAct) : undefined,
  });
}

export function censecJson(
  office: CensecOffice,
  quinzena: string,
  acts: CensecAct[],
  only?: Central,
): string {
  return `${JSON.stringify(censecObject(office, quinzena, acts, only), null, 2)}\n`;
}

// ---------------------------------------------------------------- XML

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function row(tag: string, fields: [string, string][]): string {
  const inner = fields
    .map(([name, value]) => `\t\t<${name}>${escapeXml(value)}</${name}>`)
    .join("\n");
  return `\t<${tag}>\n${inner}\n\t</${tag}>`;
}

function document(root: string, rows: string[]): string {
  return `<?xml version="1.0" standalone="yes"?>\n<${root}>\n${rows.join("\n")}\n</${root}>\n`;
}

/** "1234.50" as the XML takes values. */
const xmlMoney = (cents: number | null) =>
  cents === null ? "" : (cents / 100).toFixed(2);

function cepXml(acts: CensecAct[]): string {
  const rows: string[] = [];
  for (const act of acts) {
    const usucapiao = act.kind === "AtaNotarialDeUsucapiao";
    const ref = act.references[0];
    const head: [string, string][] = [
      ["TipoAtoCep", codeOf(CEP_KINDS, act.kind)],
      [
        "NaturezaEscritura",
        act.kind === "Escritura" ? codeOf(CEP_NATURES, act.nature) : "",
      ],
      [
        "NaturezaAtaNotarialDeUsucapiao",
        usucapiao ? codeOf(USUCAPIAO_NATURES, act.nature) : "",
      ],
      ["DataAto", act.date],
      ["mne", digits(act.mne)],
      ["Livro", act.book],
      ["LivroComplemento", act.bookSuffix],
      ["Folha", act.page],
      ["FolhaComplemento", act.pageSuffix],
      ["Valor", xmlMoney(act.valueCents)],
      ["ExisteBemEDireito", act.assets.length ? "1" : ""],
      ["DataContrato", act.contractDate],
      ["DataValidade", act.validity],
      ["NaturezaLitigio", codeOf(LITIGATIONS, act.litigation)],
      [
        "Acordo",
        act.agreement === "sim" ? "SIM" : act.agreement === "nao" ? "NÃO" : "",
      ],
      ["RegimeBens", codeOf(REGIMES, act.regime)],
      ["Complementacao", act.complement],
      ...(ref
        ? ([
            ["ReferenteTipoAtoCep", codeOf(CEP_REFERENCE_KINDS, ref.kind)],
            ["ReferenteCns", digits(ref.cns)],
            ["ReferenteLivro", digits(ref.book)],
            ["ReferenteLivroComplemento", ref.bookSuffix],
            ["ReferenteFolha", digits(ref.page)],
            ["ReferenteFolhaComplemento", ref.pageSuffix],
          ] as [string, string][])
        : []),
    ];
    // XML: the non-text fields without content are not written.
    const kept = head.filter(
      ([name, value]) => value !== "" || !/^Referente(Livro|Folha)$/.test(name),
    );
    for (const p of act.parties) {
      rows.push(
        row("AtoCep", [
          ...kept,
          ["ParteNome", p.name.trim()],
          [
            "ParteTipoDocumento",
            codeOf(CEP_DOCUMENTS, p.docType || "Desconhecido"),
          ],
          [
            "ParteNumeroDocumento",
            p.docType === "Cpf" || p.docType === "Cnpj"
              ? digits(p.docNumber)
              : p.docNumber,
          ],
          ["ParteIdentidade", p.identity],
          ["ParteOrgaoEmissor", p.issuer],
          ["ParteQualidade", codeOf(CEP_QUALITIES, p.quality)],
        ]),
      );
    }
    for (const a of act.assets) {
      rows.push(
        row("AtoCep", [
          ...kept,
          ["FormaPagamento", codeOf(PAYMENT_FORMS, a.paymentForm)],
          ["PrazoPagamento", codeOf(PAYMENT_TERMS, a.paymentTerm)],
          ["BemEDireitoDescricaoPormenorizada", a.description],
          ["BemEDireitoValorImovel", xmlMoney(a.valueCents)],
          ["BemEDireitoValorFiscal", xmlMoney(a.fiscalCents)],
        ]),
      );
    }
  }
  return document("CEP", rows);
}

/** The CESDI's party columns, shared by the XML and the TXT. */
function cesdiPartyColumns(
  act: CensecAct,
  p: CensecParty,
  dates: (iso: string) => string,
) {
  const couple = CESDI_COUPLE_KINDS.has(act.kind) && p.quality !== "Advogado";
  const main =
    p.docType === "Cpf" || p.docType === "Cnpj"
      ? digits(p.docNumber)
      : p.docNumber.trim();
  // The advogado: the OAB first and the CPF second, as the CNB/CF's example.
  const [type1, number1, uf1, type2, number2] = p.oab
    ? ["OAB", p.oab, p.oabUf, codeOf(CESDI_DOCUMENTS, p.docType), main]
    : [
        codeOf(CESDI_DOCUMENTS, p.docType),
        main,
        "",
        p.identity ? "RG" : "",
        p.identity.trim(),
      ];
  return {
    NOMEPARTE: p.name.trim(),
    QUALIDADE: codeOf(CESDI_QUALITIES, p.quality),
    CONJUGE: couple
      ? p.spouse === "Conjuge1"
        ? "01"
        : p.spouse === "Conjuge2"
          ? "02"
          : ""
      : "",
    TIPODOCUMENTO1: type1,
    NUMERO1: number1,
    UF1: uf1,
    TIPODOCUMENTO2: type2,
    NUMERO2: number2,
    DATANASCIMENTO: couple ? dates(p.birthDate) : "",
    LOCALNASCIMENTOPAIS: couple ? p.birthCountry.toUpperCase() : "",
    LOCALNASCIMENTOUF: couple ? p.birthUf : "",
    LOCALRESIDENCIAPAIS: couple ? p.residenceCountry.toUpperCase() : "",
    LOCALRESIDENCIAUF: couple ? p.residenceUf : "",
    LOCALRESIDENCIAMUNICIPIO: couple ? p.residenceCity : "",
    SEXO: couple ? p.sex : "",
  };
}

function cesdiActColumns(
  act: CensecAct,
  p: CensecParty,
  dates: (iso: string) => string,
) {
  const couple = CESDI_COUPLE_KINDS.has(act.kind) && p.quality !== "Advogado";
  const two = (value: string) =>
    /^\d{1,2}$/.test(value.trim()) ? value.trim().padStart(2, "0") : "";
  return {
    TIPOATOCESDI: codeOf(CESDI_KINDS, act.kind),
    DATAATO: dates(act.date),
    LIVRO: act.book,
    LIVROCOMPLEMENTO: act.bookSuffix,
    FOLHA: act.page,
    FOLHACOMPLEMENTO: act.pageSuffix,
    DATACASAMENTO: couple ? dates(act.marriageDate) : "",
    REGIMEBENS: couple ? codeOf(REGIMES, act.regime) : "",
    QUANTIDADEFILHOSMAIORES: couple ? two(act.adultChildren) : "",
    QUANTIDADEFILHOSMENORES: couple ? two(act.minorChildren) : "",
    RESPFILHOSMENORES: couple ? codeOf(CUSTODY, act.custody) : "",
  };
}

function cesdiXml(acts: CensecAct[]): string {
  const rows: string[] = [];
  const iso = (value: string) => value;
  for (const act of acts) {
    const ref = act.references[0];
    for (const p of act.parties) {
      const a = cesdiActColumns(act, p, iso);
      const q = cesdiPartyColumns(act, p, iso);
      const fields: [string, string][] = [
        ["TipoAtoCesdi", a.TIPOATOCESDI],
        ["DataAto", a.DATAATO],
        ["mne", digits(act.mne)],
        ["Livro", a.LIVRO],
        ["LivroComplemento", a.LIVROCOMPLEMENTO],
        ["Folha", a.FOLHA],
        ["FolhaComplemento", a.FOLHACOMPLEMENTO],
        ...(ref
          ? ([
              ["ReferenteTipoAtoCesdi", codeOf(CESDI_KINDS, ref.kind)],
              ["ReferenteCns", digits(ref.cns)],
              ["ReferenteLivro", digits(ref.book)],
              ["ReferenteLivroComplemento", ref.bookSuffix],
              ["ReferenteFolha", digits(ref.page)],
              ["ReferenteFolhaComplemento", ref.pageSuffix],
            ] as [string, string][])
          : []),
        ["DataCasamento", a.DATACASAMENTO],
        ["RegimeBens", a.REGIMEBENS],
        ["QuantidadeFilhosMaiores", a.QUANTIDADEFILHOSMAIORES],
        ["QuantidadeFilhosMenores", a.QUANTIDADEFILHOSMENORES],
        ["RespFilhosMenores", a.RESPFILHOSMENORES],
        ["NomeParte", q.NOMEPARTE],
        ["Qualidade", q.QUALIDADE],
        ["Conjuge", q.CONJUGE],
        ["TipoDocumento1", q.TIPODOCUMENTO1],
        ["Numero1", q.NUMERO1],
        ["Uf1", q.UF1],
        ["TipoDocumento2", q.TIPODOCUMENTO2],
        ["Numero2", q.NUMERO2],
        ["DataNascimento", q.DATANASCIMENTO],
        ["LocalNascimentoPais", q.LOCALNASCIMENTOPAIS],
        ["LocalNascimentoUF", q.LOCALNASCIMENTOUF],
        ["LocalResidenciaPais", q.LOCALRESIDENCIAPAIS],
        ["LocalResidenciaUF", q.LOCALRESIDENCIAUF],
        ["LocalResidenciaMunicipio", q.LOCALRESIDENCIAMUNICIPIO],
        ["Sexo", q.SEXO],
      ];
      // DataCasamento, DataNascimento and Conjuge: left out when empty
      // (the CNB/CF's XML rule for non-text fields).
      rows.push(
        row(
          "AtoCesdi",
          fields.filter(
            ([name, value]) =>
              value !== "" ||
              !/^(DataCasamento|DataNascimento|Conjuge|ReferenteLivro|ReferenteFolha)$/.test(
                name,
              ),
          ),
        ),
      );
    }
  }
  return document("Cesdi", rows);
}

function rctoXml(acts: CensecAct[]): string {
  const rows = acts.map((act) => {
    const t = act.testator;
    const r = act.revocation;
    const revocation =
      act.kind === "Revogacao" || act.kind === "TestamentoComRevogacao";
    const fields: [string, string][] = [
      ["TipoTestamento", codeOf(RCTO_KINDS, act.kind)],
      ["mne", digits(act.mne)],
      ["cpf", digits(t.cpf)],
      ["Nome", t.name.trim()],
      ["DataNascimento", t.birthDate],
      ["NomeMae", t.mother.trim()],
      ["NomePai", t.father.trim()],
      ["DataTestamento", act.date],
      ["Livro", act.book],
      ["LivroComplemento", act.bookSuffix],
      ["Folha", act.page],
      ["FolhaComplemento", act.pageSuffix],
      ["TipoDocumento", codeOf(RCTO_DOCUMENTS, t.docType)],
      ["Documento", t.doc],
      ["DocumentoComplemento", t.docComplement],
      ["Observacoes", act.observations],
      ...(revocation
        ? ([
            ["RevogacaoCartorioCns", digits(r.cns)],
            ["RevogacaoLivro", digits(r.book)],
            ["RevogacaoLivroComplemento", r.bookSuffix],
            ["RevogacaoFolha", digits(r.page)],
            ["RevogacaoFolhaComplemento", r.pageSuffix],
            ["RevogacaoDataTestamento", r.date],
            ["DesconhecidoOutros", r.unknown],
          ] as [string, string][])
        : []),
    ];
    return row(
      "Testamento",
      fields.filter(
        ([name, value]) =>
          value !== "" ||
          !/^Revogacao(Livro|Folha|DataTestamento|CartorioCns)$/.test(name),
      ),
    );
  });
  return document("RCTO", rows);
}

export function censecXml(central: Central, acts: CensecAct[]): string {
  const mine = acts.filter((a) => a.central === central);
  if (central === "cep") return cepXml(mine);
  if (central === "cesdi") return cesdiXml(mine);
  return rctoXml(mine);
}

// ---------------------------------------------------------------- TXT

const brDate = (iso: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
    : "";

const quoted = (values: string[]) =>
  values
    .map((v) => `"${v.replace(/"/g, "'").replace(/[\r\n;]+/g, " ")}"`)
    .join(";");

/** The CESDI's columns, in the order of the CNB/CF's example file. */
const CESDI_TXT_COLUMNS = [
  "TIPOATOCESDI",
  "DATAATO",
  "LIVRO",
  "LIVROCOMPLEMENTO",
  "FOLHA",
  "FOLHACOMPLEMENTO",
  "DATACASAMENTO",
  "REGIMEBENS",
  "QUANTIDADEFILHOSMAIORES",
  "QUANTIDADEFILHOSMENORES",
  "RESPFILHOSMENORES",
  "NOMEPARTE",
  "QUALIDADE",
  "CONJUGE",
  "TIPODOCUMENTO1",
  "NUMERO1",
  "UF1",
  "TIPODOCUMENTO2",
  "NUMERO2",
  "DATANASCIMENTO",
  "LOCALNASCIMENTOPAIS",
  "LOCALNASCIMENTOUF",
  "LOCALRESIDENCIAPAIS",
  "LOCALRESIDENCIAUF",
  "LOCALRESIDENCIAMUNICIPIO",
  "SEXO",
] as const;

/** The RCTO's columns, in the order of the CNB/CF's example file. */
const RCTO_TXT_COLUMNS = [
  "tipoTestamento",
  "nome",
  "dataNascimento",
  "tipoDocumento",
  "documento",
  "documentoComplemento",
  "cpf",
  "nomeMae",
  "nomePai",
  "dataTestamento",
  "livro",
  "livroComplemento",
  "folha",
  "folhaComplemento",
  "observacoes",
  "revogacaoUF",
  "revogacaoCidade",
  "revogacaoCartorio",
  "revogacaoLivro",
  "revogacaoLivroComplemento",
  "revogacaoFolha",
  "revogacaoFolhaComplemento",
  "revogacaoDataTestamento",
  "desconhecidoOutros",
  "mne",
] as const;

/** Whether the CNB/CF publishes the TXT columns of the central. */
export const hasTxt = (central: Central) => central !== "cep";

export function censecTxt(central: Central, acts: CensecAct[]): string {
  const mine = acts.filter((a) => a.central === central);
  if (central === "cesdi") {
    const lines = [quoted([...CESDI_TXT_COLUMNS])];
    for (const act of mine) {
      for (const p of act.parties) {
        const values: Record<string, string> = {
          ...cesdiActColumns(act, p, brDate),
          ...cesdiPartyColumns(act, p, brDate),
        };
        lines.push(quoted(CESDI_TXT_COLUMNS.map((c) => values[c] ?? "")));
      }
    }
    return `${lines.join("\r\n")}\r\n`;
  }
  if (central === "rcto") {
    const lines = [quoted([...RCTO_TXT_COLUMNS])];
    for (const act of mine) {
      const t = act.testator;
      const r = act.revocation;
      const revocation =
        act.kind === "Revogacao" || act.kind === "TestamentoComRevogacao";
      const values: Record<string, string> = {
        tipoTestamento: codeOf(RCTO_KINDS, act.kind),
        nome: t.name.trim(),
        dataNascimento: brDate(t.birthDate),
        tipoDocumento: codeOf(RCTO_DOCUMENTS, t.docType),
        documento: t.doc,
        documentoComplemento: t.docComplement,
        cpf: digits(t.cpf),
        nomeMae: t.mother.trim(),
        nomePai: t.father.trim(),
        dataTestamento: brDate(act.date),
        livro: act.book,
        livroComplemento: act.bookSuffix,
        folha: act.page,
        folhaComplemento: act.pageSuffix,
        observacoes: act.observations,
        revogacaoLivro: revocation ? digits(r.book) : "",
        revogacaoLivroComplemento: revocation ? r.bookSuffix : "",
        revogacaoFolha: revocation ? digits(r.page) : "",
        revogacaoFolhaComplemento: revocation ? r.pageSuffix : "",
        revogacaoDataTestamento: revocation ? brDate(r.date) : "",
        desconhecidoOutros: revocation ? r.unknown : "",
        mne: digits(act.mne),
      };
      lines.push(quoted(RCTO_TXT_COLUMNS.map((c) => values[c] ?? "")));
    }
    return `${lines.join("\r\n")}\r\n`;
  }
  return "";
}
