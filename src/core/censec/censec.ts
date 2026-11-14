import {
  addDays,
  type IsoDate,
  isBusinessDay,
  type OfficeHolidays,
} from "../scheduling/calendar.ts";
import { isValidTaxId } from "../tax-id.ts";
import { validMne } from "../titularidade/titularidade.ts";

/**
 * The CENSEC's quinzenal loads (decision of 14/11/2026: "gerar cargas ...
 * ao fazer as leituras das escrituras"), as the Código Nacional de Normas
 * (Provimento CNJ nº 149/2023) sets them, read on the CNJ's consolidated
 * text on 14/11/2026:
 *
 * - art. 265: the CENSEC's modules, among them the Registro Central de
 *   Testamentos On-Line (RCTO), the Central de Escrituras de Separações,
 *   Divórcios e Inventários (CESDI) and the Central de Escrituras e
 *   Procurações (CEP);
 * - arts. 267 (RCTO), 270 (CESDI) and 272 (CEP): sent every fortnight, up
 *   to the 20th for the first fortnight of the month and up to the 5th of
 *   the next month for the second, or the next business day; with no act,
 *   the "informação negativa"; the proof of sending kept;
 * - art. 272: the CEP takes the escrituras and procurações except the
 *   separações, divórcios and inventários (CESDI) and the testamentos
 *   (RCTO); art. 267, § 2º: of the testamento, the testador only;
 * - art. 169: the essential data of each act (the client, the operation
 *   described, its value, the tax value, the date, the form of payment).
 *
 * The fields and their tables are the CNB/CF's own (CENSEC's Swagger,
 * Atos.AtoCepData, Atos.AtoCesdiData and Atos.TestamentoData, and the
 * "Especificação dos campos de carga" of each central, consulted on
 * 14/11/2026). Each table keeps, per option, the name the JSON takes, the
 * number the XML and the TXT take, and the words the screen shows.
 */

export type Option = readonly [json: string, code: string, label: string];

export const CENTRALS = {
  cep: {
    short: "CEP",
    label: "Central de Escrituras e Procurações",
    article: "art. 272",
  },
  cesdi: {
    short: "CESDI",
    label: "Central de Escrituras de Separações, Divórcios e Inventários",
    article: "art. 270",
  },
  rcto: {
    short: "RCTO",
    label: "Registro Central de Testamentos On-Line",
    article: "art. 267",
  },
} as const;
export type Central = keyof typeof CENTRALS;
export const isCentral = (value: string): value is Central =>
  Object.hasOwn(CENTRALS, value);

export const CEP_KINDS: readonly Option[] = [
  ["Escritura", "1", "Escritura"],
  ["Procuracao", "2", "Procuração"],
  [
    "ProcuracaoParaFinsPrevidenciarios",
    "3",
    "Procuração para fins previdenciários",
  ],
  ["RenunciaDeProcuracao", "5", "Renúncia de procuração"],
  ["RevogacaoDeProcuracao", "6", "Revogação de procuração"],
  ["Substabelecimento", "7", "Substabelecimento"],
  ["AtaNotarial", "8", "Ata notarial"],
  ["AtaNotarialDeUsucapiao", "9", "Ata notarial de usucapião"],
];

/** The kinds of the act a revogação, renúncia or substabelecimento refers to. */
export const CEP_REFERENCE_KINDS: readonly Option[] = [
  ...CEP_KINDS,
  ["ProcuracaoPrivada", "10", "Procuração privada"],
  [
    "ProcuracaoAutoridadeEstrangeira",
    "11",
    "Procuração de autoridade estrangeira (não consular)",
  ],
];

/** The kinds that need the original act (referentes). */
export const CEP_KINDS_WITH_REFERENCE = new Set([
  "RenunciaDeProcuracao",
  "RevogacaoDeProcuracao",
  "Substabelecimento",
]);

/**
 * NaturezaEscritura. The five cessões of the specification's v4.2
 * (05/11/2026) have no number yet: they go by JSON only.
 */
export const CEP_NATURES: readonly Option[] = [
  ["AcordoExtrajudicial", "1", "Acordo extrajudicial"],
  ["AlienacaoFiduciaria", "4", "Alienação fiduciária"],
  ["Cessao", "5", "Cessão"],
  ["CompraEVenda", "6", "Compra e venda"],
  [
    "ConfissaoDeDividaOuDacaoEmPagamento",
    "10",
    "Confissão de dívida ou dação em pagamento",
  ],
  ["Declaracao", "14", "Declaração"],
  ["DeclaratoriaDeUniaoEstavel", "15", "Declaratória de união estável"],
  [
    "DeclaratoriaDeUniaoEstavelHomoafetiva",
    "16",
    "Declaratória de união estável homoafetiva",
  ],
  ["Desapropriacao", "17", "Desapropriação"],
  ["DissolucaoDeUniaoEstavel", "20", "Dissolução de união estável"],
  ["Distrato", "21", "Distrato"],
  ["Doacao", "22", "Doação"],
  ["Emancipacao", "23", "Emancipação"],
  ["Hipoteca", "24", "Hipoteca"],
  ["Incorporacao", "25", "Incorporação"],
  ["BemDeFamilia", "26", "Bem de família"],
  ["Locacao", "28", "Locação"],
  ["PactoAnteNupcial", "30", "Pacto antenupcial"],
  ["Penhor", "31", "Penhor"],
  [
    "PromessaDeCessaoDeDireitosAquisitivos",
    "33",
    "Promessa de cessão de direitos aquisitivos",
  ],
  ["Quitacao", "34", "Quitação"],
  ["Rerratificacao", "35", "Rerratificação"],
  ["ReconhecimentoDePaternidade", "36", "Reconhecimento de paternidade"],
  ["RegistroDeChancelaMecanica", "38", "Registro de chancela mecânica"],
  ["RemissaoDeForoELaudemios", "39", "Remissão de foro e laudêmios"],
  ["SemValorDeclarado", "43", "Sem valor declarado"],
  ["Servidao", "45", "Servidão"],
  ["Usufruto", "46", "Usufruto (reserva, instituição e renúncia)"],
  ["Condominio", "48", "Condomínio"],
  ["Parcelamento", "49", "Parcelamento"],
  ["SociedadeEFundacoes", "50", "Sociedade e fundações"],
  ["Transacao", "51", "Transação"],
  ["DireitoDeUsoOuSuperficie", "52", "Direito de uso ou superfície"],
  ["Divisao", "53", "Divisão"],
  ["Fianca", "54", "Fiança"],
  ["DiretivasAntecipadasDeVontade", "55", "Diretivas antecipadas de vontade"],
  ["ConferenciaDeBens", "56", "Conferência de bens"],
  ["Novacao", "57", "Novação"],
  ["CreditoComGarantia", "58", "Crédito com garantia"],
  ["EmissaoDeCedula", "59", "Emissão de cédula"],
  ["EmissaoDeDebentures", "60", "Emissão de debêntures"],
  ["Revogacao", "61", "Revogação"],
  ["RenunciaDeDireitosHereditarios", "62", "Renúncia de direitos hereditários"],
  ["ComodatoOuMutuo", "63", "Comodato ou mútuo"],
  ["PrestacaoDeServico", "70", "Prestação de serviços"],
  ["ArrendamentoMercantil", "71", "Arrendamento mercantil (leasing)"],
  ["ConcessaoDeDominio", "72", "Concessão de domínio"],
  ["ContratoDeNamoro", "74", "Contrato de namoro"],
  ["Conciliacao", "75", "Conciliação"],
  ["Mediacao", "76", "Mediação"],
  ["Afetacao", "77", "Afetação"],
  ["Autocuratela", "78", "Autocuratela"],
  [
    "DeclaratoriaComDiretivasDeCuratela",
    "79",
    "Declaratória com diretivas de curatela",
  ],
  ["PromessaDeCompraEVenda", "80", "Promessa de compra e venda"],
  ["CessaoDeDireitosHereditarios", "", "Cessão de direitos hereditários"],
  ["CessaoDeContratos", "", "Cessão de contratos"],
  ["CessaoDeDireitoCreditorio", "", "Cessão de direito creditório"],
  ["CessaoDePosse", "", "Cessão de posse"],
  ["CessaoDePrecatorios", "", "Cessão de precatórios"],
];

export const USUCAPIAO_NATURES: readonly Option[] = [
  ["Ordinaria", "1", "Ordinária"],
  ["Extraordinaria", "2", "Extraordinária"],
  ["EspecialRural", "3", "Especial rural"],
  ["EspecialUrbana", "4", "Especial urbana"],
  ["EspecialFamiliar", "5", "Especial familiar"],
];

/** ParteQualidade: the code column is the XML's spelling. */
export const CEP_QUALITIES: readonly Option[] = [
  ["Outorgante", "OUTORGANTE", "Outorgante"],
  ["Outorgado", "OUTORGADO", "Outorgado"],
  [
    "Interveniente",
    "INTERVENIENTE",
    "Interveniente (anuente, assistente, a rogo, credor, testemunha)",
  ],
  ["Usufrutuario", "USUFRUTUÁRIO", "Usufrutuário"],
  ["Requerente", "REQUERENTE", "Requerente (conciliação, mediação)"],
  ["Requerido", "REQUERIDO", "Requerido (conciliação, mediação)"],
  ["Conciliador", "CONCILIADOR", "Conciliador"],
  ["Mediador", "MEDIADOR", "Mediador"],
];

/** ParteTipoDocumento of the CEP (JSON name, XML spelling). */
export const CEP_DOCUMENTS: readonly Option[] = [
  ["Cpf", "CPF", "CPF"],
  ["Cnpj", "CNPJ", "CNPJ"],
  ["Rnm", "RNM", "RNM (Registro Nacional Migratório)"],
  ["Cin", "CIN", "CIN (Carteira de Identidade Nacional)"],
  ["Rg", "RG", "RG"],
  ["Rne", "RNE", "RNE"],
  ["Passaporte", "PASSAPORTE", "Passaporte"],
  ["Cnh", "CNH", "CNH"],
  ["Ctps", "CTPS", "CTPS"],
  [
    "CarteiraIdentidadeMilitar",
    "CARTEIRAIDENTIDADEMILITAR",
    "Carteira de identidade militar",
  ],
  ["Crnm", "CRNM", "CRNM"],
  ["Dprnm", "DPRNM", "DPRNM"],
  ["Desconhecido", "DESCONHECIDO", "Não tem documento conhecido"],
];

export const PAYMENT_FORMS: readonly Option[] = [
  ["Cheque", "1", "Cheque"],
  ["Dinheiro", "2", "Dinheiro"],
  ["NotaPromissoria", "3", "Nota promissória"],
  ["Permuta", "4", "Permuta"],
  ["Transferencia", "5", "Transferência"],
  ["Outras", "6", "Outras"],
];

export const PAYMENT_TERMS: readonly Option[] = [
  ["AVista", "1", "À vista"],
  ["APrazo", "2", "A prazo"],
  ["Antecipado", "3", "Antecipado"],
  ["Aditamento", "4", "Aditamento (rerratificação)"],
];

/** regimeBens: the code column is the XML/TXT spelling. */
export const REGIMES: readonly Option[] = [
  ["ComunhaoParcial", "Comunhão Parcial", "Comunhão parcial"],
  ["ComunhaoUniversal", "Comunhão Universal", "Comunhão universal"],
  [
    "ParticipacaoFinalNosAquestos",
    "Particip. Final nos Aquestos",
    "Participação final nos aquestos",
  ],
  ["SeparacaoTotal", "Separação Total", "Separação total"],
  ["SeparacaoObrigatoria", "Separação Obrigatória", "Separação obrigatória"],
  [
    "RegimeEspecificoAtribuidoEmPactoAntenupcial",
    "Regime específico atribuído em Pacto Antenupcial",
    "Regime específico do pacto antenupcial",
  ],
];

export const LITIGATIONS: readonly Option[] = [
  ["Bancario", "1", "Bancário"],
  ["ConcessionariaDeAgua", "2", "Concessionária de água"],
  ["ConcessionariaDeGas", "3", "Concessionária de gás"],
  ["ConcessionariaDeLuz", "4", "Concessionária de luz"],
  ["Consumidor", "5", "Consumidor"],
  ["Contrato", "6", "Contrato"],
  ["Empresarial", "7", "Empresarial"],
  ["Familia", "8", "Família"],
  ["Locacao", "9", "Locação"],
  ["Mobiliario", "10", "Mobiliário"],
  ["Previdencia", "11", "Previdência"],
  ["Saude", "12", "Saúde"],
  ["Seguro", "13", "Seguro"],
  ["ServicoPublico", "14", "Serviço público"],
  ["Sucessoes", "15", "Sucessões"],
  ["Telefonia", "16", "Telefonia"],
  ["Transporte", "17", "Transporte"],
  ["TransporteAviao", "18", "Transporte (avião)"],
  ["TransporteBarco", "19", "Transporte (barco)"],
  ["TransporteMetro", "20", "Transporte (metrô)"],
  ["TransporteOnibus", "21", "Transporte (ônibus)"],
];

export const CESDI_KINDS: readonly Option[] = [
  ["Separacao", "1", "Separação"],
  [
    "Reconciliacao",
    "2",
    "Reconciliação (restabelecimento da sociedade conjugal)",
  ],
  ["ConversaoDeSeparacaoEmDivorcio", "3", "Conversão de separação em divórcio"],
  ["DivorcioDireto", "4", "Divórcio direto"],
  ["Inventario", "5", "Inventário"],
  ["Sobrepartilha", "6", "Sobrepartilha"],
  ["Retificacao", "7", "Retificação"],
  ["NomeacaoDeInventariante", "8", "Nomeação de inventariante"],
  ["Partilha", "9", "Partilha"],
  ["InventarioComMenorOuIncapaz", "10", "Inventário com menor ou incapaz"],
  ["RetificacaoAtoNaoNotarial", "11", "Retificação de ato não notarial"],
];

/** The couple's acts: marriage, regime, children and custody are asked. */
export const CESDI_COUPLE_KINDS = new Set([
  "Separacao",
  "ConversaoDeSeparacaoEmDivorcio",
  "DivorcioDireto",
]);

export const CESDI_KINDS_WITH_REFERENCE = new Set([
  "Retificacao",
  "RetificacaoAtoNaoNotarial",
]);

/** qualidade of the CESDI: the code column is the XML/TXT spelling. */
export const CESDI_QUALITIES: readonly Option[] = [
  ["Separando", "SEPARANDO(A)", "Separando(a)"],
  ["Reconciliando", "RECONCILIANDO(A)", "Reconciliando(a)"],
  ["Divorciando", "DIVORCIANDO(A)", "Divorciando(a)"],
  ["Falecido", "FALECIDO(A)", "Falecido(a), autor(a) da herança"],
  ["Viuvo", "VIUVO(A)", "Viúvo(a), cônjuge sobrevivente"],
  ["Companheiro", "COMPANHEIRO(A)", "Companheiro(a) sobrevivente"],
  ["Herdeiro", "HERDEIRO(A)", "Herdeiro(a)"],
  ["Inventariante", "INVENTARIANTE", "Inventariante"],
  ["Advogado", "ADVOGADO(A)", "Advogado(a)"],
  [
    "CessionarioAdjudicatarios",
    "CESSIONÁRIO/ADJUDICATÁRIOS",
    "Cessionário ou adjudicatário",
  ],
  ["Cedente", "CEDENTE", "Cedente"],
  ["Interveniente", "INTERVENIENTE", "Interveniente"],
  ["Anuente", "ANUENTE", "Anuente"],
];

/** What each act of the CESDI accepts (the specification's table). */
const COMMON = [
  "Advogado",
  "CessionarioAdjudicatarios",
  "Cedente",
  "Interveniente",
  "Anuente",
];
const ESTATE = ["Falecido", "Viuvo", "Companheiro", "Herdeiro"];
export const CESDI_QUALITIES_BY_KIND: Record<string, readonly string[]> = {
  Separacao: ["Separando", ...COMMON],
  Reconciliacao: ["Reconciliando", ...COMMON],
  ConversaoDeSeparacaoEmDivorcio: ["Divorciando", ...COMMON],
  DivorcioDireto: ["Divorciando", ...COMMON],
  Inventario: [...ESTATE, "Inventariante", ...COMMON],
  InventarioComMenorOuIncapaz: [...ESTATE, "Inventariante", ...COMMON],
  Sobrepartilha: [...ESTATE, "Divorciando", ...COMMON],
  Retificacao: ["Divorciando", "Separando", ...ESTATE, ...COMMON],
  RetificacaoAtoNaoNotarial: ["Divorciando", "Separando", ...ESTATE, ...COMMON],
  NomeacaoDeInventariante: [...ESTATE, "Inventariante", ...COMMON],
  Partilha: [...ESTATE, "Divorciando", ...COMMON],
};

/** RESPONSAVELFILHOSMENORES: the TXT/XML numbers are the table's order. */
export const CUSTODY: readonly Option[] = [
  ["Conjuge1", "01", "Cônjuge 1"],
  ["Conjuge2", "02", "Cônjuge 2"],
  ["AmbosConjuges", "03", "Ambos os cônjuges"],
  ["Outros", "04", "Outros"],
  ["SemDeclaracao", "05", "Sem declaração"],
];

export const CESDI_DOCUMENTS: readonly Option[] = [
  ["Cpf", "CPF", "CPF"],
  ["Cnpj", "CNPJ", "CNPJ"],
  ["Oab", "OAB", "OAB (advogado)"],
  ["Rg", "RG", "RG"],
  ["Cin", "CIN", "CIN"],
  ["Rnm", "RNM", "RNM"],
  ["Rne", "RNE", "RNE"],
  ["Passaporte", "PASSAPORTE", "Passaporte"],
  ["Cnh", "CNH", "CNH"],
  ["Ctps", "CTPS", "CTPS"],
  [
    "CarteiraIdentidadeMilitar",
    "CARTEIRAIDENTIDADEMILITAR",
    "Carteira de identidade militar",
  ],
  ["Crnm", "CRNM", "CRNM"],
  ["Dprnm", "DPRNM", "DPRNM"],
  ["Outros", "Outros", "Outro documento"],
  ["Desconhecido", "Desconhecido", "Não tem documento conhecido"],
];

export const RCTO_KINDS: readonly Option[] = [
  ["Aditamento", "1", "Aditamento"],
  ["Cerrado", "2", "Cerrado (instrumento de aprovação)"],
  ["Revogacao", "3", "Revogação"],
  ["Testamento", "4", "Testamento público"],
  ["TestamentoComRevogacao", "5", "Testamento com revogação"],
  [
    "TestamentoSemConteudoPatrimonial",
    "6",
    "Testamento sem conteúdo patrimonial",
  ],
];

export const RCTO_KINDS_WITH_REVOCATION = new Set(["Revogacao"]);

export const RCTO_DOCUMENTS: readonly Option[] = [
  ["Rg", "RG", "RG"],
  ["Rne", "RNE", "RNE"],
  ["Oab", "OAB", "OAB"],
  ["Outros", "OUTROS", "Outro (diga o órgão no complemento)"],
];

export const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export const KINDS: Record<Central, readonly Option[]> = {
  cep: CEP_KINDS,
  cesdi: CESDI_KINDS,
  rcto: RCTO_KINDS,
};

export const optionOf = (table: readonly Option[], json: string) =>
  table.find((o) => o[0] === json);
export const labelOf = (table: readonly Option[], json: string) =>
  optionOf(table, json)?.[2] ?? json;
export const codeOf = (table: readonly Option[], json: string) =>
  optionOf(table, json)?.[1] ?? "";

// ---------------------------------------------------------------- the act

export interface CensecParty {
  name: string;
  /** The central's qualidade, by its JSON name. */
  quality: string;
  docType: string;
  docNumber: string;
  /** RG and its issuer (CEP); the second document (CESDI). */
  identity: string;
  issuer: string;
  foreign: boolean;
  // CESDI
  spouse: "" | "Conjuge1" | "Conjuge2";
  birthDate: string;
  birthCountry: string;
  birthUf: string;
  residenceCountry: string;
  residenceUf: string;
  /** The IBGE code of the city of residence. */
  residenceCity: string;
  sex: "" | "F" | "M";
  /** The advogado's OAB number and its state. */
  oab: string;
  oabUf: string;
}

export interface CensecAsset {
  description: string;
  valueCents: number | null;
  fiscalCents: number | null;
  paymentForm: string;
  paymentTerm: string;
  matricula: string;
  cnm: string;
}

/** The original act of a revogação, renúncia, substabelecimento or retificação. */
export interface CensecReference {
  kind: string;
  cns: string;
  book: string;
  bookSuffix: string;
  page: string;
  pageSuffix: string;
  country: string;
}

export interface Testator {
  name: string;
  cpf: string;
  birthDate: string;
  mother: string;
  father: string;
  docType: string;
  doc: string;
  docComplement: string;
}

export interface Revocation {
  cns: string;
  date: string;
  book: string;
  bookSuffix: string;
  page: string;
  pageSuffix: string;
  unknown: string;
}

export interface CensecAct {
  central: Central;
  /** tipoAtoCep, tipoAtoCesdi or tipoTestamento, by its JSON name. */
  kind: string;
  /** naturezaEscritura, or the usucapião's nature. */
  nature: string;
  mne: string;
  date: string;
  book: string;
  bookSuffix: string;
  page: string;
  pageSuffix: string;
  valueCents: number | null;
  regime: string;
  contractDate: string;
  validity: string;
  reserve: "" | "sim" | "nao";
  litigation: string;
  agreement: "" | "sim" | "nao";
  complement: string;
  // CESDI
  marriageDate: string;
  adultChildren: string;
  minorChildren: string;
  custody: string;
  // RCTO
  testator: Testator;
  observations: string;
  revocation: Revocation;
  parties: CensecParty[];
  assets: CensecAsset[];
  references: CensecReference[];
  /** The office's own note; never sent. */
  notes: string;
}

export function emptyParty(): CensecParty {
  return {
    name: "",
    quality: "",
    docType: "",
    docNumber: "",
    identity: "",
    issuer: "",
    foreign: false,
    spouse: "",
    birthDate: "",
    birthCountry: "",
    birthUf: "",
    residenceCountry: "",
    residenceUf: "",
    residenceCity: "",
    sex: "",
    oab: "",
    oabUf: "",
  };
}

export const emptyAsset = (): CensecAsset => ({
  description: "",
  valueCents: null,
  fiscalCents: null,
  paymentForm: "",
  paymentTerm: "",
  matricula: "",
  cnm: "",
});

export const emptyReference = (): CensecReference => ({
  kind: "",
  cns: "",
  book: "",
  bookSuffix: "",
  page: "",
  pageSuffix: "",
  country: "",
});

export function emptyAct(central: Central = "cep"): CensecAct {
  return {
    central,
    kind: "",
    nature: "",
    mne: "",
    date: "",
    book: "",
    bookSuffix: "",
    page: "",
    pageSuffix: "",
    valueCents: null,
    regime: "",
    contractDate: "",
    validity: "",
    reserve: "",
    litigation: "",
    agreement: "",
    complement: "",
    marriageDate: "",
    adultChildren: "",
    minorChildren: "",
    custody: "",
    testator: {
      name: "",
      cpf: "",
      birthDate: "",
      mother: "",
      father: "",
      docType: "",
      doc: "",
      docComplement: "",
    },
    observations: "",
    revocation: {
      cns: "",
      date: "",
      book: "",
      bookSuffix: "",
      page: "",
      pageSuffix: "",
      unknown: "",
    },
    parties: [],
    assets: [],
    references: [],
    notes: "",
  };
}

/** A stored act with the fields it may lack (older rows), filled. */
export function actOf(raw: Partial<CensecAct>): CensecAct {
  const base = emptyAct(raw.central ?? "cep");
  return {
    ...base,
    ...raw,
    testator: { ...base.testator, ...(raw.testator ?? {}) },
    revocation: { ...base.revocation, ...(raw.revocation ?? {}) },
    parties: (raw.parties ?? []).map((p) => ({ ...emptyParty(), ...p })),
    assets: (raw.assets ?? []).map((a) => ({ ...emptyAsset(), ...a })),
    references: (raw.references ?? []).map((r) => ({
      ...emptyReference(),
      ...r,
    })),
  };
}

// ---------------------------------------------------------------- quinzena

const pad = (n: number) => String(n).padStart(2, "0");
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-11-1" (days 1 to 15) or "2026-11-2" (16 to the end). */
export function quinzenaOf(iso: string): string {
  if (!ISO.test(iso)) return "";
  return `${iso.slice(0, 7)}-${Number(iso.slice(8, 10)) <= 15 ? 1 : 2}`;
}

export const isQuinzena = (value: string) => /^\d{4}-\d{2}-[12]$/.test(value);

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "1ª quinzena de novembro de 2026". */
export function quinzenaLabel(quinzena: string): string {
  if (!isQuinzena(quinzena)) return quinzena;
  const [year, month, half] = quinzena.split("-").map(Number);
  return `${half}ª quinzena de ${MONTHS[(month ?? 1) - 1]} de ${year}`;
}

/** The days the quinzena covers: "01/11/2026 a 15/11/2026". */
export function quinzenaDays(quinzena: string): {
  first: IsoDate;
  last: IsoDate;
} {
  const [year, month, half] = quinzena.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const start = `${year}-${pad(month)}-${half === 1 ? "01" : "16"}` as IsoDate;
  if (half === 1)
    return { first: start, last: `${year}-${pad(month)}-15` as IsoDate };
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    first: start,
    last: addDays(`${nextYear}-${pad(nextMonth)}-01` as IsoDate, -1),
  };
}

/** The quinzena before and after, for the screen's arrows. */
export function shiftQuinzena(quinzena: string, by: -1 | 1): string {
  const [year, month, half] = quinzena.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  let index = year * 24 + (month - 1) * 2 + (half - 1) + by;
  const y = Math.floor(index / 24);
  index -= y * 24;
  return `${y}-${pad(Math.floor(index / 2) + 1)}-${(index % 2) + 1}`;
}

/**
 * The deadline (CNN, arts. 267, 270 and 272): the 20th for the first
 * fortnight, the 5th of the next month for the second; when that day is
 * not a business day, the next one (§ 1º of each).
 */
export function censecDeadline(
  quinzena: string,
  holidays: OfficeHolidays = {},
): IsoDate {
  const [year, month, half] = quinzena.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  let day: IsoDate;
  if (half === 1) day = `${year}-${pad(month)}-20` as IsoDate;
  else {
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    day = `${nextYear}-${pad(nextMonth)}-05` as IsoDate;
  }
  while (!isBusinessDay(day, holidays)) day = addDays(day, 1);
  return day;
}

// ---------------------------------------------------------------- checks

const digits = (value: string) => value.replace(/\D/g, "");
const validCpf = (value: string) =>
  digits(value).length === 11 && isValidTaxId(digits(value));

/** What keeps the act out of the file: the CENSEC refuses it. */
export function actProblems(act: CensecAct): string[] {
  const problems: string[] = [];
  const central = CENTRALS[act.central];
  if (!act.kind) problems.push(`Escolha o tipo do ato (${central.short}).`);
  if (!ISO.test(act.date)) problems.push("Falta a data do ato.");
  if (!/^\d+$/.test(act.book))
    problems.push("O livro deve ter só números (a letra vai no complemento).");
  if (!/^\d+$/.test(act.page))
    problems.push("A folha deve ter só números (a letra vai no complemento).");
  if (
    act.mne &&
    !(digits(act.mne).length === 24 && validMne(digits(act.mne)))
  ) {
    problems.push(
      "A MNE não confere: são 24 números com o dígito verificador.",
    );
  }
  if (act.central === "rcto") {
    const t = act.testator;
    if (!t.name.trim()) problems.push("Falta o nome do testador.");
    if (!validCpf(t.cpf))
      problems.push("O CPF do testador é obrigatório e deve ser válido.");
    if (!ISO.test(t.birthDate))
      problems.push("Falta a data de nascimento do testador.");
    if (t.docType === "Outros" && !t.docComplement.trim()) {
      problems.push('Documento "Outro": diga qual é e o órgão no complemento.');
    }
    if (RCTO_KINDS_WITH_REVOCATION.has(act.kind)) {
      const r = act.revocation;
      if (
        !digits(r.cns) ||
        !ISO.test(r.date) ||
        !/^\d+$/.test(r.book) ||
        !/^\d+$/.test(r.page)
      ) {
        problems.push(
          "Revogação: informe o CNS do cartório, a data, o livro e a folha do testamento revogado.",
        );
      }
    }
    return problems;
  }
  if (act.parties.length === 0) problems.push("Inclua ao menos uma parte.");
  act.parties.forEach((p, i) => {
    const who = p.name.trim() || `Parte ${i + 1}`;
    if (!p.name.trim()) problems.push(`${who}: falta o nome.`);
    if (!p.quality) problems.push(`${who}: escolha a qualidade.`);
    if (act.central === "cep" && !p.docType)
      problems.push(`${who}: escolha o tipo do documento.`);
    if (
      act.central === "cesdi" &&
      p.quality === "Advogado" &&
      (!p.oab || !p.oabUf)
    ) {
      problems.push(`${who}: informe a OAB e o estado do advogado(a).`);
    }
    if (act.central === "cesdi" && !p.docType && !p.identity && !p.oab) {
      problems.push(
        `${who}: escolha o tipo do documento (ou "Não tem documento conhecido").`,
      );
    }
    if (p.docType === "Cpf" && !validCpf(p.docNumber)) {
      problems.push(
        `${who}: o CPF não é válido; o CENSEC recusa o arquivo inteiro.`,
      );
    }
    if (
      p.docType === "Cnpj" &&
      !(digits(p.docNumber).length === 14 && isValidTaxId(digits(p.docNumber)))
    ) {
      problems.push(`${who}: o CNPJ não é válido.`);
    }
  });
  if (act.central === "cep") {
    if (act.kind === "Escritura" && !act.nature)
      problems.push("Escritura: escolha a natureza.");
    if (act.kind === "AtaNotarialDeUsucapiao" && !act.nature) {
      problems.push(
        "Ata de usucapião: escolha a natureza (ordinária, extraordinária...).",
      );
    }
    if (
      CEP_KINDS_WITH_REFERENCE.has(act.kind) ||
      act.nature === "Rerratificacao"
    ) {
      const r = act.references[0];
      if (
        !r ||
        !r.kind ||
        !digits(r.cns) ||
        !/^\d+$/.test(r.book) ||
        !/^\d+$/.test(r.page)
      ) {
        problems.push(
          "Informe o ato de origem (tipo, CNS do cartório, livro e folha).",
        );
      }
    }
    if (
      (act.nature === "Conciliacao" || act.nature === "Mediacao") &&
      (!act.litigation || !act.agreement)
    ) {
      problems.push(
        "Conciliação e mediação: informe a natureza do litígio e se houve acordo.",
      );
    }
  }
  if (act.central === "cesdi" && CESDI_KINDS_WITH_REFERENCE.has(act.kind)) {
    const r = act.references[0];
    if (
      !r ||
      !digits(r.cns) ||
      !/^\d+$/.test(r.book) ||
      !/^\d+$/.test(r.page)
    ) {
      problems.push(
        "Retificação: informe o ato retificado (CNS, livro e folha).",
      );
    }
  }
  return problems;
}

/** What the CENSEC's rules ask and the file still takes without. */
export function actWarnings(act: CensecAct): string[] {
  const warnings: string[] = [];
  if (act.central === "rcto") {
    if (!act.testator.mother.trim())
      warnings.push("Falta o nome da mãe do testador (a especificação pede).");
    return warnings;
  }
  if (act.central === "cep") {
    if (act.kind === "Escritura" && act.valueCents === null) {
      warnings.push(
        "Sem valor: o CENSEC pede o valor do negócio (0,00 se a escritura não tem valor).",
      );
    }
    if (
      (act.nature === "DeclaratoriaDeUniaoEstavel" ||
        act.nature === "DeclaratoriaDeUniaoEstavelHomoafetiva" ||
        act.nature === "DissolucaoDeUniaoEstavel") &&
      !act.regime
    ) {
      warnings.push("União estável: informe o regime de bens.");
    }
  }
  if (act.central === "cesdi") {
    const count = (q: string) =>
      act.parties.filter((p) => p.quality === q).length;
    if (
      count("Advogado") === 0 &&
      act.kind !== "NomeacaoDeInventariante" &&
      !CESDI_KINDS_WITH_REFERENCE.has(act.kind)
    ) {
      warnings.push("O CESDI pede o advogado(a) entre as partes.");
    }
    if (CESDI_COUPLE_KINDS.has(act.kind)) {
      const spouses = act.parties.filter((p) => p.spouse);
      if (spouses.length < 2)
        warnings.push(
          "Separação e divórcio: marque o cônjuge 1 e o cônjuge 2.",
        );
      if (!ISO.test(act.marriageDate))
        warnings.push("Falta a data do casamento.");
      if (!act.regime) warnings.push("Falta o regime de bens.");
      if (!act.custody)
        warnings.push(
          'Falta o responsável pelos filhos menores (ou "Sem declaração").',
        );
      for (const p of spouses) {
        if (!ISO.test(p.birthDate) || !p.sex || !p.residenceCity) {
          warnings.push(
            `${p.name || "Cônjuge"}: faltam nascimento, sexo ou município de residência.`,
          );
        }
      }
    }
    if (
      (act.kind === "Inventario" ||
        act.kind === "InventarioComMenorOuIncapaz" ||
        act.kind === "Partilha") &&
      count("Falecido") === 0
    ) {
      warnings.push("Inventário e partilha: inclua o(a) falecido(a).");
    }
    const allowed = CESDI_QUALITIES_BY_KIND[act.kind];
    for (const p of act.parties) {
      if (allowed && p.quality && !allowed.includes(p.quality)) {
        warnings.push(
          `${p.name}: a qualidade ${labelOf(CESDI_QUALITIES, p.quality)} não cabe neste ato.`,
        );
      }
    }
  }
  if (!act.mne) {
    warnings.push(
      "Sem MNE: só é obrigatória se o ato foi feito no e-Notariado.",
    );
  }
  return warnings;
}

/** The act in one line, for lists and reports. */
export function actTitle(act: CensecAct): string {
  const kind = labelOf(KINDS[act.central], act.kind) || "Ato";
  const nature =
    act.central === "cep" && act.nature
      ? ` · ${labelOf(act.kind === "AtaNotarialDeUsucapiao" ? USUCAPIAO_NATURES : CEP_NATURES, act.nature)}`
      : "";
  return `${kind}${nature}`;
}

export function actWhere(act: CensecAct): string {
  return [
    act.book && `Livro ${act.book}${act.bookSuffix}`,
    act.page && `folha ${act.page}${act.pageSuffix}`,
  ]
    .filter(Boolean)
    .join(", ");
}

/** The names of the act, for lists. */
export function actNames(act: CensecAct): string {
  if (act.central === "rcto") return act.testator.name;
  return act.parties
    .filter((p) => p.quality !== "Advogado")
    .map((p) => p.name)
    .join("; ");
}
