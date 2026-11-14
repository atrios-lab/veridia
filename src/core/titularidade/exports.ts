import {
  doiOf,
  OPERATIONS,
  PROPERTY_TYPES as PROPERTY_LABELS,
  SERVICES,
  type TitleTransfer,
  type TransferParty,
} from "./titularidade.ts";

/**
 * The files the office downloads and attaches to the systems that take
 * them (decision of 14/11/2026: "gera em word, PDF e ofereça outras
 * extensões, pois alguns sistemas aceitam"):
 *
 * - the Carga CTP, the month's communication of transactions to the
 *   prefeitura (CNN, art. 184-A), in XML, JSON and TXT, besides the CSV
 *   (documents.ts) and the ofício in PDF and Word;
 * - the DOI, the Declaração sobre Operações Imobiliárias to the Receita
 *   Federal, with the field names of the RFB's import manual for the
 *   DOI-Web (JSON, the format DOI-Web imports) and the same in XML.
 *
 * Only what the act says goes in: a field the title does not have is left
 * out, never invented (the DOI-Web manual: "atributos sem conteúdo não
 * devem ser enviados"), and the DOI-Web points out what is missing.
 */

export const EXPORT_FORMATS = {
  "ctp-xml": {
    label: "Carga CTP em XML (sistemas da prefeitura que leem XML)",
    ext: "xml",
    type: "application/xml",
  },
  "ctp-json": {
    label: "Carga CTP em JSON para o CENSEC (cabeçalho e leiaute da DOI)",
    ext: "json",
    type: "application/json",
  },
  "ctp-txt": {
    label: "Relação em TXT (separado por |)",
    ext: "txt",
    type: "text/plain",
  },
  "ctp-csv": {
    label: "Planilha (CSV, abre no Excel)",
    ext: "csv",
    type: "text/csv",
  },
  "doi-json": {
    label: "DOI em JSON (DOI-Web)",
    ext: "json",
    type: "application/json",
  },
  "doi-xml": { label: "DOI em XML", ext: "xml", type: "application/xml" },
  "doi-pgd": {
    label: "DOI no formato PGD (DOI.TXT, linhas de 365 posições)",
    ext: "txt",
    type: "text/plain",
  },
} as const;
export type ExportFormat = keyof typeof EXPORT_FORMATS;

export const isExportFormat = (value: string): value is ExportFormat =>
  Object.hasOwn(EXPORT_FORMATS, value);

export interface OfficeForExport {
  name: string;
  city: string;
  state: string;
  /** CNS of the office, when known. */
  cns?: string;
}

const digits = (value: string) => value.replace(/\D/g, "");
const money = (cents: number | null) =>
  cents === null ? undefined : Number((cents / 100).toFixed(2));

/** "50%", "1/2", "0,5" → 50; blank or unreadable → undefined. */
export function shareOf(text: string): number | undefined {
  const t = text.trim();
  if (!t) return undefined;
  const fraction = /^(\d+)\s*\/\s*(\d+)$/.exec(t);
  if (fraction) {
    const value = (Number(fraction[1]) / Number(fraction[2])) * 100;
    return Number.isFinite(value) ? Number(value.toFixed(4)) : undefined;
  }
  const n = Number(t.replace("%", "").replace(",", ".").trim());
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n <= 1 && !t.includes("%") ? Number((n * 100).toFixed(4)) : n;
}

/** Drops undefined and empty strings, as the DOI-Web asks. */
function compact<T extends Record<string, unknown>>(object: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(object).filter(
      ([, value]) => value !== undefined && value !== "" && value !== null,
    ),
  ) as Partial<T>;
}

// ---------------------------------------------------------------- CTP

/** The CNS as the CENSEC takes it: "09.461-5" → 94615. */
export function cnsNumber(cns: string | undefined): number {
  const n = Number(digits(cns ?? ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * The fields of the CENSEC's own CTP declaration (Swagger of censec.org.br,
 * schema Doi.CtpData, additionalProperties false). It is the DOI's layout
 * ("mesmo layout JSON da Receita Federal, com a adição do cabeçalho"),
 * with three differences: the IBGE code of the municipality goes at the
 * root and is required, there is no tipoLivro nor numeroRegistroAverbacao
 * (the CTP is the notary's; the registro de imóveis informs the ONR), and
 * municipiosUF lists only the other municipalities of a rural imóvel.
 */
const CTP_FIELDS = new Set([
  "tipoDeclaracao",
  "dataLavraturaRegistroAverbacao",
  "tipoAto",
  "numeroLivro",
  "folha",
  "matriculaNotarialEletronica",
  "matricula",
  "codigoNacionalMatricula",
  "dataNegocioJuridico",
  "tipoOperacaoImobiliaria",
  "descricaoOutrasOperacoesImobiliarias",
  "valorOperacaoImobiliaria",
  "indicadorNaoConstaValorOperacaoImobiliaria",
  "valorBaseCalculoItbiItcmd",
  "indicadorNaoConstaValorBaseCalculoItbiItcmd",
  "formaPagamento",
  "indicadorAlienacaoFiduciaria",
  "mesAnoUltimaParcela",
  "valorPagoAteDataAto",
  "indicadorPermutaBens",
  "indicadorPagamentoDinheiro",
  "valorPagoMoedaCorrenteDataAto",
  "tipoParteTransacionada",
  "valorParteTransacionada",
  "cib",
  "destinacao",
  "indicadorImovelPublicoUniao",
  "registroImobiliarioPatrimonial",
  "certidaoAutorizacaoTransferencia",
  "inscricaoMunicipal",
  "codigoIbge",
  "areaImovel",
  "indicadorAreaLoteNaoConsta",
  "areaConstruida",
  "indicadorAreaConstruidaNaoConsta",
  "tipoImovel",
  "tipoLogradouro",
  "nomeLogradouro",
  "numeroImovel",
  "complementoNumeroImovel",
  "complementoEndereco",
  "bairro",
  "cep",
  "codigoIncra",
  "denominacao",
  "localizacao",
  "tipoServico",
  "municipiosUF",
  "alienantes",
  "adquirentes",
]);

/**
 * The CENSEC takes the DOI's tables by name, not by code (the enums of its
 * Swagger, Doi.CtpData, in the order of the DOI's tables).
 */
const CTP_NAMES: Record<string, Record<string, string>> = {
  tipoDeclaracao: { "0": "Original" },
  tipoServico: { "1": "Notarial", "2": "RegistroImoveis" },
  tipoAto: { "1": "Escritura", "2": "Procuracao" },
  tipoOperacaoImobiliaria: {
    "11": "CompraEVenda",
    "13": "Permuta",
    "15": "Adjudicacao",
    "19": "DacaoEmPagamento",
    "21": "DistratoDeNegocio",
    "23": "RetificacaoDoAto",
    "25": "Desapropriacao",
    "27": "HerancaLegadoOuMeacao",
    "31": "ProcuracaoEmCausaPropria",
    "33": "PromessaDeCompraEVenda",
    "35": "PromessaDeCessaoDeDireitos",
    "37": "CessaoDeDireitos",
    "39": "Outros",
    "41": "AlienacaoPorIniciativaParticularOuLeilaoJudicial",
    "43": "DissolucaoDeSociedade",
    "45": "IncorporacaoELoteamento",
    "47": "IntegralizacaoSubscricaoDeCapital",
    "49": "PartilhaAmigavelOuLitigiosa",
    "51": "RetornoDeCapitalProprio",
    "53": "Doacao",
    "55": "DoacaoEmAdiantamentoDaLegitima",
    "56": "Aforamento",
    "57": "CasamentoEmComunhaoUniversalDeBens",
    "58": "CisaoTotalOuParcial",
    "59": "CompraEVendaDeImovelGravadoPorEnfiteuse",
    "60": "ConcessaoDeDireitoRealDeUsoCDRU",
    "61": "ConcessaoDeUsoEspecialParaFinsDeMoradiaCUEM",
    "62": "ConsolidacaoDaPropriedadeEmNomeDoFiduciario",
    "63": "DesapropriacaoParaFinsDeReformaAgraria",
    "64": "DesapropriacaoExcetoParaReformaAgraria",
    "65": "DireitoDeLaje",
    "66": "DireitoDeSuperficie",
    "67": "DoacaoExcetoEmAdiantamentoDeLegitima",
    "68": "Incorporacao",
    "69": "Inventario",
    "70": "PartSeparacaoDivorcioUniaoEstavel",
    "71": "RetornoDeCapitalProprioNaExtincaoDePessoaJuridica",
    "72": "RetornoDeCapitalProprioExcetoNaExtincaoDePessoaJuridica",
    "73": "TituloDeDominioTD",
    "74": "Usucapiao",
  },
  formaPagamento: {
    "5": "QuitadoAVista",
    "7": "APrazo",
    "9": "NaoSeAplica",
    "10": "QuitadoAPrazo",
    "11": "QuitadoSemInformacaoDaFormaDePagamento",
  },
  tipoParteTransacionada: { "1": "Percentual", "2": "HaM2" },
  destinacao: { "1": "Urbano", "3": "Rural" },
  tipoImovel: {
    "15": "Loja",
    "17": "SalaConjunto",
    "31": "Galpao",
    "33": "PredioComercial",
    "35": "PredioResidencial",
    "65": "Apartamento",
    "67": "Casa",
    "69": "FazendaSitioChacara",
    "71": "TerrenoFracao",
    "73": "SalaLoja",
    "85": "Construcoes",
    "87": "Desmembramento",
    "89": "Outros",
    "90": "Sala",
    "91": "ConjuntoDeSalas",
    "92": "Sobreloja",
    "93": "VagaDeGaragem",
    "94": "Laje",
    "95": "Estacionamento",
    "96": "Barraco",
  },
  motivoNaoIdentificacaoNi: {
    "1": "SemCPFCNPJDecisaoJudicial",
    "2": "NaoConstaNoDocumento",
  },
};

/** The month as the CENSEC's QuinzenaModel names it. */
export const CENSEC_MONTHS = [
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

function named<T extends Record<string, unknown>>(object: T) {
  return Object.fromEntries(
    Object.entries(object).map(([key, value]) => {
      const names = CTP_NAMES[key];
      return [
        key,
        names && typeof value === "string" ? (names[value] ?? value) : value,
      ];
    }),
  );
}

/** A party of the CTP: the DOI's, with the representante indicator. */
function ctpParty(p: TransferParty) {
  return named({ ...doiParty(p), indicadorRepresentante: false });
}

/** One act of notas as the CENSEC's "Registro de CTP" takes it. */
export function ctpDeclaration(t: TitleTransfer) {
  const d = doiOf(t);
  const base: Record<string, unknown> = { ...doiDeclaration(t) };
  delete base.municipiosUF;
  if (d.ibge.length === 7) base.codigoIbge = d.ibge;
  // The CTP's manual: with the CEP really unknown, "n/c" in the street
  // keeps the other parts of the address from being checked.
  if (!base.cep && t.destination !== "rural") base.nomeLogradouro = "n/c";
  const kept = Object.fromEntries(
    Object.entries(base).filter(([key]) => CTP_FIELDS.has(key)),
  );
  return {
    ...named(kept),
    alienantes: t.transmitentes.map(ctpParty),
    adquirentes: t.adquirentes.map(ctpParty),
  };
}

/**
 * The Carga CTP as the CENSEC takes it, by upload (CTP › Cargas, the month
 * and the JSON file) or by its API: the header with the office's CNS and
 * the competence ("como a CTP tem periodicidade mensal, informe
 * quinzenaReferencia com 2"), then one declaration per act of notas. An
 * empty month (mês negativo) has no file: the CENSEC asks only the
 * fechamento negativo, and the empty list is kept for the office's file.
 */
export function ctpObject(
  office: OfficeForExport,
  competence: string,
  transfers: TitleTransfer[],
) {
  return {
    cns: cnsNumber(office.cns),
    quinzena: {
      anoReferencia: Number(competence.slice(0, 4)),
      mesReferencia: CENSEC_MONTHS[Number(competence.slice(5, 7)) - 1],
      quinzenaReferencia: 2,
    },
    declaracoes: transfers
      .filter((t) => t.service === "notas")
      .map((t) => ctpDeclaration(t)),
  };
}

export function ctpJson(
  office: OfficeForExport,
  competence: string,
  transfers: TitleTransfer[],
): string {
  return `${JSON.stringify(ctpObject(office, competence, transfers), null, 2)}\n`;
}

/** The same in XML, for the municipal systems that read XML. */
export function ctpXml(
  office: OfficeForExport,
  competence: string,
  transfers: TitleTransfer[],
): string {
  return toXml(ctpObject(office, competence, transfers), {
    declaracoes: "declaracao",
    alienantes: "alienante",
    adquirentes: "adquirente",
    municipiosUF: "municipio",
  });
}

const pipe = (value: unknown) =>
  String(value ?? "")
    .replace(/[|\r\n]+/g, " ")
    .trim();

/**
 * The Carga CTP as plain text: a header line, one line per act and one per
 * party, fields separated by "|" (the layout of the older municipal
 * systems that read text files).
 */
export function ctpTxt(
  office: OfficeForExport,
  competence: string,
  transfers: TitleTransfer[],
): string {
  const lines = [
    [
      "H",
      office.name,
      office.cns ?? "",
      `${office.city}/${office.state}`,
      competence,
      transfers.length,
    ]
      .map(pipe)
      .join("|"),
  ];
  transfers.forEach((t, i) => {
    lines.push(
      [
        "A",
        i + 1,
        SERVICES[t.service].label,
        t.actDate,
        t.book,
        t.page,
        t.entry,
        t.operation,
        OPERATIONS[t.operation] ?? "",
        t.destination,
        t.matricula,
        t.fiscalRegistration,
        t.address,
        money(t.valueCents)?.toFixed(2) ?? "",
        money(t.taxBaseCents)?.toFixed(2) ?? "",
      ]
        .map(pipe)
        .join("|"),
    );
    for (const [kind, parties] of [
      ["T", t.transmitentes],
      ["D", t.adquirentes],
    ] as const) {
      for (const p of parties) {
        lines.push(
          [kind, i + 1, p.name, digits(p.taxId), p.share].map(pipe).join("|"),
        );
      }
    }
  });
  return `${lines.join("\r\n")}\r\n`;
}

// ---------------------------------------------------------------- DOI

const STREET_TYPES =
  /^(rua|avenida|av\.?|travessa|tv\.?|alameda|estrada|rodovia|pra[çc]a|largo|beco|vila|s[íi]tio|fazenda)\s+/i;

/** "Rua das Flores, nº 10, Centro" → its parts, as far as they are written. */
export function addressParts(address: string) {
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const first = parts[0] ?? "";
  const type = STREET_TYPES.exec(first)?.[1];
  const number = parts
    .slice(1)
    .map((p) => /^(?:n[º°o]\.?\s*)?(\d+[a-z]?|s\/n)$/i.exec(p)?.[1])
    .find(Boolean);
  const rest = parts
    .slice(1)
    .filter((p) => !/^(?:n[º°o]\.?\s*)?(\d+[a-z]?|s\/n)$/i.test(p));
  return compact({
    tipoLogradouro: type ? type.replace(/\.$/, "") : undefined,
    nomeLogradouro: type ? first.slice(type.length).trim() : first,
    numeroImovel: number,
    bairro: rest[0],
  });
}

const ACT_CODE: Record<string, string> = {
  escritura: "1",
  procuracao: "2",
  averbacao: "3",
  registro: "4",
};

const cut = (value: string, max: number) =>
  value.trim().slice(0, max) || undefined;

/**
 * One party as the DOI-Web's schema takes it (layout-doiweb.json,
 * AlienanteDTO/AdquirenteDTO): identified by the NI (CPF or CNPJ), never
 * by the name, with the four indicators the schema requires.
 */
function doiParty(p: TransferParty) {
  const ni = digits(p.taxId);
  const share = shareOf(p.share);
  return compact({
    indicadorNiIdentificado: ni.length >= 11,
    // DOI "Tabela 10": 2 = não consta no documento.
    motivoNaoIdentificacaoNi: ni.length >= 11 ? undefined : "2",
    ni: ni.length >= 11 ? ni.slice(0, 14) : undefined,
    participacao: share,
    indicadorNaoConstaParticipacaoOperacao: share === undefined,
    indicadorEstrangeiro: false,
    indicadorEspolio: /^esp[óo]lio\b/i.test(p.name),
  });
}

/** "1.234,56" → 1234.56; blank → undefined. */
const decimal = (text: string) => {
  const t = text.trim();
  if (!t) return undefined;
  const n = Number(
    t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t,
  );
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/**
 * One declaration in the DOI-Web's import layout (the RFB's
 * layout-doiweb.json, DeclaracaoDadosBasicosDTO, received from the office
 * on 14/11/2026): a flat object, no field outside the schema, each one
 * within its size; a field the title does not have is left out.
 */
export function doiDeclaration(t: TitleTransfer) {
  const notas = t.service === "notas";
  const d = doiOf(t);
  const rural = t.destination === "rural";
  const address = rural ? {} : addressParts(t.address);
  const area = decimal(d.area);
  const built = decimal(d.builtArea);
  const matricula = digits(t.matricula);
  return {
    ...compact({
      // DOI "Tabela 1": 0 = original, the only one the import takes.
      tipoDeclaracao: "0",
      tipoServico: notas ? "1" : "2",
      dataLavraturaRegistroAverbacao: t.actDate,
      tipoAto: ACT_CODE[t.act],
      tipoLivro: notas ? undefined : matricula ? "1" : undefined,
      numeroLivro: notas ? cut(t.book, 7) : undefined,
      folha: notas ? cut(t.page, 7) : undefined,
      matriculaNotarialEletronica:
        notas && d.mne ? d.mne.slice(0, 24) : undefined,
      matricula: matricula && matricula.length <= 7 ? matricula : undefined,
      numeroRegistroAverbacao: notas ? undefined : cut(digits(t.entry), 7),
      dataNegocioJuridico: t.actDate,
      tipoOperacaoImobiliaria: t.operation,
      descricaoOutrasOperacoesImobiliarias:
        t.operation === "39" ? cut(t.operationOther, 30) : undefined,
      valorOperacaoImobiliaria: money(t.valueCents),
      indicadorNaoConstaValorOperacaoImobiliaria: t.valueCents === null,
      valorBaseCalculoItbiItcmd: money(t.taxBaseCents),
      indicadorNaoConstaValorBaseCalculoItbiItcmd: t.taxBaseCents === null,
      formaPagamento: d.paymentForm,
      indicadorPermutaBens: d.exchange,
      indicadorPagamentoDinheiro: d.cash,
      valorPagoMoedaCorrenteDataAto: d.cash ? money(d.cashCents) : undefined,
      tipoParteTransacionada: d.partType,
      valorParteTransacionada: d.partType ? decimal(d.partValue) : undefined,
      // DOI "Tabela 9": 1 urbano, 3 rural.
      destinacao: rural ? "3" : t.destination === "urbano" ? "1" : undefined,
      indicadorImovelPublicoUniao: false,
      cib: rural ? cut(d.cib, 8) : undefined,
      codigoIncra: rural ? cut(d.incra, 13) : undefined,
      denominacao: rural ? cut(t.description, 200) : undefined,
      inscricaoMunicipal: cut(t.fiscalRegistration, 45),
      tipoImovel: d.propertyType,
      areaImovel: area,
      indicadorAreaLoteNaoConsta: area === undefined,
      areaConstruida: built,
      indicadorAreaConstruidaNaoConsta: built === undefined,
      tipoLogradouro: cut(address.tipoLogradouro ?? "", 30),
      nomeLogradouro: cut(address.nomeLogradouro ?? "", 150),
      numeroImovel: cut(address.numeroImovel ?? "", 10),
      bairro: cut(address.bairro ?? "", 150),
      cep: d.cep.length === 8 ? d.cep : undefined,
    }),
    ...(d.ibge.length === 7 ? { municipiosUF: [{ codigoIbge: d.ibge }] } : {}),
    alienantes: t.transmitentes.map(doiParty),
    adquirentes: t.adquirentes.map(doiParty),
  };
}

export function doiObject(transfers: TitleTransfer[]) {
  return { declaracoes: transfers.map((t) => doiDeclaration(t)) };
}

export function doiJson(transfers: TitleTransfer[]): string {
  return `${JSON.stringify(doiObject(transfers), null, 2)}\n`;
}

export function doiXml(transfers: TitleTransfer[]): string {
  return toXml(doiObject(transfers), {
    declaracoes: "declaracao",
    alienantes: "alienante",
    adquirentes: "adquirente",
    municipiosUF: "municipio",
  });
}

// ---------------------------------------------------------------- PGD

/**
 * DOI-Web operation codes → the PGD's ("Tipo da transação", ajuda DOI
 * importação PGD, versão 6.1). The PGD's older list has no own code for
 * some: they go as 39 (outros) with the description.
 */
const PGD_OPERATION: Record<string, string> = {
  "11": "11",
  "13": "13",
  "15": "15",
  "19": "19",
  "21": "21",
  "31": "31",
  "33": "33",
  "35": "35",
  "37": "37",
  "41": "41",
  "45": "45",
  "47": "47",
  "55": "55",
  "63": "25",
  "64": "25",
  "67": "53",
  "69": "27",
  "70": "49",
  "71": "51",
  "72": "51",
};

const PGD_PROPERTY: Record<string, string> = {
  "67": "67",
  "65": "65",
  "15": "15",
  "90": "17",
  "91": "17",
  "71": "71",
  "31": "31",
  "69": "69",
};

/** DOI-Web payment form → PGD: 5 à vista, 7 a prazo, 9 não se aplica. */
const PGD_PAYMENT: Record<string, string> = {
  "5": "5",
  "10": "7",
  "7": "7",
  "9": "9",
};

const asciiUpper = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .toUpperCase();

/** Left-aligned text, cut and padded with spaces. */
const alpha = (value: string, size: number) =>
  asciiUpper(value).slice(0, size).padEnd(size, " ");
/** Right-aligned, padded with spaces (alphanumeric rule). */
const right = (value: string, size: number) =>
  asciiUpper(value).slice(-size).padStart(size, " ");
/** Right-aligned with zeros (numeric rule). */
const zeros = (value: string, size: number) =>
  value.slice(-size).padStart(size, "0");
/** "20000,00", no thousands point, two decimals, zero-padded. */
const pgdMoney = (cents: number | null, size: number) =>
  cents === null
    ? " ".repeat(size)
    : zeros((cents / 100).toFixed(2).replace(".", ","), size);
const pgdDate = (iso: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
    : " ".repeat(10);

const RECORD = 365;

function pgdParty(kind: "2" | "3", p: TransferParty): string {
  const ni = digits(p.taxId);
  const share = shareOf(p.share);
  const line =
    kind +
    " ".repeat(10) +
    (ni ? right(ni, 14) : " ".repeat(14)) +
    " ".repeat(115) +
    (share === undefined
      ? " ".repeat(6)
      : zeros(share.toFixed(2).replace(".", ","), 6)) +
    " ".repeat(11);
  return line.padEnd(RECORD, " ");
}

/**
 * The DOI in the PGD's import file (DOI.TXT): records of 365 positions
 * plus CRLF, type 1 per declaration followed by its alienantes (2) and
 * adquirentes (3), and the type 9 with the count, as the RFB's "Ajuda DOI,
 * leiaute para importar" (versão 6.1) sets them.
 */
export function doiPgd(
  transfers: TitleTransfer[],
  officeCity: string,
  officeUf: string,
): string {
  const lines: string[] = [];
  for (const t of transfers) {
    const d = doiOf(t);
    const address = addressParts(t.address);
    const operation = PGD_OPERATION[t.operation] ?? "39";
    const property =
      PGD_PROPERTY[d.propertyType] ?? (d.propertyType ? "89" : "  ");
    const area = decimal(d.area);
    const record =
      "1" +
      " ".repeat(10) +
      pgdDate(t.actDate) +
      right(t.service === "notas" ? t.book : "", 7) +
      right(t.service === "notas" ? (t.page.split(/[/-]/)[0] ?? "") : "", 5) +
      right(digits(t.matricula), 15) +
      right(t.service === "ri" ? t.entry : "", 15) +
      "0" +
      (t.service === "notas" ? "1" : "2") +
      zeros(operation, 2) +
      alpha(
        operation === "39"
          ? t.operationOther || (OPERATIONS[t.operation] ?? "")
          : "",
        30,
      ) +
      "0" +
      pgdDate(t.actDate) +
      (PGD_PAYMENT[d.paymentForm] ?? "9") +
      (t.valueCents === null ? "1" : "0") +
      pgdMoney(t.valueCents, 15) +
      pgdMoney(t.taxBaseCents, 15) +
      property +
      alpha(
        property === "89" ? (PROPERTY_LABELS[d.propertyType] ?? "") : "",
        30,
      ) +
      (d.propertyType === "71" ? "2" : decimal(d.builtArea) ? "0" : "2") +
      (t.destination === "rural" ? "3" : "1") +
      (area === undefined ? "1" : "0") +
      (area === undefined
        ? " ".repeat(17)
        : zeros(area.toFixed(2).replace(".", ","), 17)) +
      alpha(
        [address.tipoLogradouro, address.nomeLogradouro]
          .filter(Boolean)
          .join(" "),
        40,
      ) +
      alpha(address.numeroImovel ?? "", 6) +
      alpha("", 21) +
      alpha(address.bairro ?? "", 20) +
      alpha(d.cep, 8) +
      alpha(d.city || officeCity, 30) +
      alpha(officeUf, 2) +
      alpha(digits(t.fiscalRegistration), 15) +
      (t.taxBaseCents === null ? "1" : "0") +
      " ".repeat(30);
    lines.push(record.padEnd(RECORD, " ").slice(0, RECORD));
    for (const p of t.transmitentes) lines.push(pgdParty("2", p));
    for (const p of t.adquirentes) lines.push(pgdParty("3", p));
  }
  lines.push(
    `9${" ".repeat(16)}${zeros(String(lines.length + 1), 6)}`.padEnd(
      RECORD,
      " ",
    ),
  );
  return `${lines.join("\r\n")}\r\n`;
}

// ---------------------------------------------------------------- XML

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * A plain object as XML, the keys as elements; a list becomes its key with
 * one child per item, named by `items` (atos → ato).
 */
export function toXml(
  value: Record<string, unknown>,
  items: Record<string, string>,
): string {
  const out: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];
  const write = (key: string, node: unknown, depth: number) => {
    const pad = "  ".repeat(depth);
    if (node === undefined || node === null) return;
    if (Array.isArray(node)) {
      out.push(`${pad}<${key}>`);
      for (const item of node) write(items[key] ?? "item", item, depth + 1);
      out.push(`${pad}</${key}>`);
    } else if (typeof node === "object") {
      out.push(`${pad}<${key}>`);
      for (const [k, v] of Object.entries(node)) write(k, v, depth + 1);
      out.push(`${pad}</${key}>`);
    } else {
      out.push(`${pad}<${key}>${escapeXml(String(node))}</${key}>`);
    }
  };
  for (const [key, node] of Object.entries(value)) write(key, node, 0);
  return `${out.join("\n")}\n`;
}
