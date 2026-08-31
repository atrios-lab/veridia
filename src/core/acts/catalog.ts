import type { Attribution, Tenant } from "../tenant/schema.ts";
import { ATTRIBUTIONS } from "../tenant/schema.ts";

// Display names for the legal attributions. The keys keep the official
// acronyms; only the label is translated, because it is user visible.
export const ATTRIBUTION_NAMES: Record<Attribution, string> = {
  RCPN: "Registro Civil das Pessoas Naturais",
  NOTAS: "Tabelionato de Notas",
  RI: "Registro de Imóveis",
  PROTESTO: "Tabelionato de Protesto",
  RTD: "Registro de Títulos e Documentos",
  RCPJ: "Registro Civil das Pessoas Jurídicas",
};

/** How the attribution is named where the full legal name would not fit. */
export const ATTRIBUTION_SHORT_NAMES: Record<Attribution, string> = {
  RCPN: "Registro Civil",
  NOTAS: "Notas",
  RI: "Registro de Imóveis",
  PROTESTO: "Protesto",
  RTD: "Títulos e Documentos",
  RCPJ: "Pessoas Jurídicas",
};

/**
 * What each attribution solves, in the words a citizen would use. Someone who
 * does not know what RCPN stands for cannot pick it from the acronym, and the
 * acronym is all the previous site offered.
 */
export const ATTRIBUTION_EXAMPLES: Record<Attribution, string> = {
  RCPN: "Certidão de nascimento, casamento, óbito, retificações",
  NOTAS: "Escrituras, procurações, autenticações e reconhecimento de firma",
  RI: "Matrícula, registro de compra e venda, averbações",
  PROTESTO: "Certidão de protesto, cancelamento, anuência",
  RTD: "Registro de contratos e documentos, notificações",
  RCPJ: "Atas, estatutos, associações e sociedades simples",
};

/**
 * How a request for the act travels. It is the one fact a citizen needs before
 * filling anything in, so it belongs to the act, not to the screen.
 */
export const PROCESSING_MODES = [
  "online", // signed digitally, start to finish over the internet
  "presential", // started online, finished at the counter in person
] as const;
export type ProcessingMode = (typeof PROCESSING_MODES)[number];

/** The promise each mode makes, phrased for someone outside the trade. */
export const PROCESSING_MODE_LABELS: Record<ProcessingMode, string> = {
  online: "100% on-line",
  presential: "On-line + presencial",
};

export const PROCESSING_MODE_HINTS: Record<ProcessingMode, string> = {
  online: "requerimento assinado pelo Gov.br",
  presential: "adiante aqui, conclua no balcão",
};

/**
 * The other half of what used to be one field. `identification` lived in the
 * enum above and said what the office asks for; `online` and `presential` say
 * where the request ends. A certificate answers both, and the enum let it say
 * only one, so it said the wrong one.
 *
 * Its old hint promised "sem requerimento", which was never true: the success
 * screen asks for the signed requerimento on every act the site takes. That
 * promise is gone and does not come back in gentler words.
 */
export const IDENTIFICATION_ONLY_LABEL = "Só identificação";
export const IDENTIFICATION_ONLY_HINT =
  "a serventia só pede a sua identificação";

/** Extra fact the office needs to find the right band in the fee table. */
export type ActParameter = "transactionValue" | "registryYears";

export interface Act {
  id: string;
  attribution: Attribution;
  /** User visible label, in Portuguese. */
  name: string;
  processingMode: ProcessingMode;
  /**
   * Whether the office needs nothing from the requester beyond identifying
   * themselves. Optional and never written as `false`: most acts do ask for
   * papers, and spelling that out in every one of them would be noise.
   */
  identificationOnly?: true;
  legalBasis: string;
  /**
   * Only a few acts may ask the citizen why they want the document.
   * Certificates may not: Lei 6.015 art. 17 forbids requiring a motive.
   */
  requiresPurpose: boolean;
  /** Papers the office expects, shown as a checklist before submitting. */
  documents?: string[];
  /** What to bring and how it goes, for acts finished at the counter. */
  guidance?: string;
  /**
   * Not a price: the site never quotes one. It is the input the operator needs
   * to find the band in the court's fee table when the act is charged by band.
   */
  parameter?: ActParameter;
  /** Without a description there is no way to know what was asked for. */
  requiresDescription?: boolean;
  /**
   * The term the law fixes for this act, in business days: what a protocol of
   * it is born with. Absent where no statute fixes one (every notarial act,
   * and the registral procedures that run to their own rite), and there the
   * office's own default stands in (see `effectiveDeadline`).
   *
   * Absent is never a guess. Only terms read off the statute are here, each
   * one named in `legalDeadlineNote`; filling the gaps is the office's call,
   * not this file's, because an invented legal term is worse than none.
   */
  legalDeadlineDays?: number;
  /** Where the term above comes from. Shown to nobody: it is here so the next
   * person can check the number instead of trusting it. */
  legalDeadlineNote?: string;
  /**
   * The statute that makes this act free for someone who declares they cannot
   * pay. Absent means no exemption is foreseen, which is most acts: writing
   * `undefined` in twenty declarations would be noise.
   *
   * The basis is per act because they are different laws, and it is here for
   * the same reason `legalDeadlineNote` is: so the next person can check the
   * citation instead of trusting it.
   */
  feeExemption?: { legalBasis: string };
}

/**
 * What the requester signs to ask for the exemption. Its own text, not the
 * general truth declaration: that one covers the facts of the request, this
 * one authorises a check against a government benefit system and names the
 * penalties. Different consents, different proofs.
 *
 * It rides in the requerimento the citizen signs, so the wording is the
 * office's to confirm, not this file's to invent quietly.
 */
export const FEE_EXEMPTION_DECLARATION =
  "Declaro, sob as penas da lei, ser beneficiário de programa social do " +
  "Governo Federal (CadÚnico) e não ter condições de pagar os emolumentos " +
  "sem prejuízo do sustento próprio ou da família. Autorizo a serventia a " +
  "conferir esta condição nos sistemas governamentais de benefício social. " +
  "Estou ciente de que declaração falsa é crime (Código Penal art. 299) e " +
  "obriga a reparar o dano (Código Civil arts. 186 e 927).";

// Legal basis conferred against the previous system (packages/tenants/src/
// atos.ts), which cites Lei 6.015, Lei 8.935, Lei 9.492 and Prov. CNJ
// 149/2023. The catalogue is national: what an office offers is this list
// filtered by attribution, never a list of its own.
export const ACTS: Act[] = [
  // Registro Civil das Pessoas Naturais
  {
    id: "rcpn-certidao",
    attribution: "RCPN",
    name: "Certidão (nascimento, casamento, óbito)",
    processingMode: "online",
    identificationOnly: true,
    legalBasis: "Lei 6.015 art. 17",
    legalDeadlineDays: 5,
    legalDeadlineNote:
      "Lei 6.015 art. 19, red. Lei 14.382/2022: demais certidões",
    requiresPurpose: false, // art. 17: neither motive nor interest may be asked
    feeExemption: {
      legalBasis: "CF art. 5º, LXXVI; Lei 6.015 art. 30 §1º (Lei 9.534/97)",
    },
  },
  {
    id: "rcpn-habilitacao-casamento",
    attribution: "RCPN",
    name: "Habilitação de casamento",
    processingMode: "online",
    legalBasis: "Lei 6.015 art. 67 (CC art. 1.525)",
    requiresPurpose: false,
    feeExemption: { legalBasis: "CC art. 1.512, parágrafo único" },
    documents: [
      "Documento de identidade dos nubentes",
      "Certidões de nascimento",
      "Comprovante de residência",
    ],
  },
  {
    id: "rcpn-retificacao",
    attribution: "RCPN",
    name: "Retificação administrativa de assento",
    processingMode: "online",
    legalBasis: "Lei 6.015 art. 110",
    requiresPurpose: false,
    documents: [
      "Petição assinada",
      "Certidão a retificar",
      "Documentos que comprovem o erro",
    ],
  },
  {
    id: "rcpn-alteracao-prenome",
    attribution: "RCPN",
    name: "Alteração imotivada de prenome na maioridade",
    processingMode: "presential",
    legalBasis: "Lei 6.015 art. 56 (Lei 14.382/2022)",
    requiresPurpose: false,
    guidance:
      "Comparecimento pessoal do interessado com documento de identidade. " +
      "O pedido é imotivado: você não precisa justificar a alteração.",
  },

  // Tabelionato de Notas
  {
    id: "notas-escritura",
    attribution: "NOTAS",
    name: "Escritura pública ou procuração",
    processingMode: "presential",
    legalBasis: "Lei 8.935 art. 7 I",
    requiresPurpose: false,
    guidance:
      "Partes presentes com documento de identidade e CPF. Traga os " +
      "documentos do ato pretendido.",
  },
  {
    id: "notas-ata-notarial",
    attribution: "NOTAS",
    name: "Ata notarial",
    processingMode: "online",
    legalBasis: "Lei 8.935 art. 7 III",
    requiresPurpose: false,
    documents: [
      "Documento de identidade do solicitante",
      "Descrição do fato a constatar",
    ],
  },
  {
    id: "notas-abertura-firma",
    attribution: "NOTAS",
    name: "Abertura de firma (cartão de assinaturas)",
    processingMode: "presential",
    legalBasis: "Lei 8.935 art. 7 IV",
    requiresPurpose: false,
    guidance:
      "Comparecimento pessoal com documento de identidade original para " +
      "depósito da assinatura.",
  },
  {
    id: "notas-certidao",
    attribution: "NOTAS",
    name: "Certidão de ato notarial",
    processingMode: "online",
    identificationOnly: true,
    legalBasis: "Lei 8.935 art. 7 (cópia de ato lavrado)",
    requiresPurpose: false,
  },

  // Registro de Imóveis
  {
    id: "ri-certidao-matricula",
    attribution: "RI",
    name: "Certidão de matrícula, inteiro teor ou ônus",
    processingMode: "online",
    identificationOnly: true,
    legalBasis: "Prov. 149 art. 123 caput",
    legalDeadlineDays: 1,
    legalDeadlineNote:
      "Lei 6.015 art. 19, red. Lei 14.382/2022: situação jurídica do imóvel. O inteiro teor tem 4 horas, que não cabe numa contagem em dias",
    // The caput asks who is requesting, never what for. Only the two entries
    // below carry the exception, and mixing them up would put an unlawful
    // question in front of every certificate.
    requiresPurpose: false,
  },
  {
    id: "ri-certidao-arquivado",
    attribution: "RI",
    name: "Certidão de documento arquivado sem previsão legal",
    processingMode: "online",
    identificationOnly: true,
    legalBasis: "Prov. 149 art. 123 par. 2 e 4",
    legalDeadlineDays: 5,
    legalDeadlineNote:
      "Lei 6.015 art. 19, red. Lei 14.382/2022: demais certidões",
    requiresPurpose: true,
  },
  {
    id: "ri-busca-indicador",
    attribution: "RI",
    name: "Busca por indicador pessoal ou real",
    processingMode: "online",
    identificationOnly: true,
    legalBasis: "Prov. 149 art. 126",
    legalDeadlineDays: 5,
    legalDeadlineNote:
      "Lei 6.015 art. 19, red. Lei 14.382/2022: demais certidões",
    requiresPurpose: true,
  },
  {
    id: "ri-retificacao",
    attribution: "RI",
    name: "Retificação de registro (área, descrição)",
    processingMode: "online",
    legalBasis: "Lei 6.015 arts. 212 e 213",
    requiresPurpose: false,
    documents: [
      "Requerimento com firma reconhecida",
      "Planta e memorial descritivo",
      "ART do responsável técnico",
    ],
  },
  {
    id: "ri-registro-titulo",
    attribution: "RI",
    name: "Registro ou averbação na matrícula",
    processingMode: "online",
    legalBasis: "Lei 6.015 arts. 167 e 182",
    legalDeadlineDays: 10,
    legalDeadlineNote:
      "Lei 6.015 art. 188, red. Lei 14.382/2022. O § 1º baixa para 5 nos casos simples, que o balcão ajusta no protocolo",
    requiresPurpose: false,
    documents: [
      "Título ou documento a ser registrado",
      "Documento de identidade do apresentante",
    ],
  },

  // Tabelionato de Protesto
  {
    id: "protesto-cancelamento",
    attribution: "PROTESTO",
    name: "Cancelamento de protesto",
    processingMode: "online",
    legalBasis: "Lei 9.492 art. 26",
    requiresPurpose: false,
    documents: [
      "Documento protestado ou carta de anuência com firma reconhecida",
      "Documento de identidade",
    ],
  },
  {
    id: "protesto-certidao",
    attribution: "PROTESTO",
    name: "Certidão de protesto",
    processingMode: "online",
    legalBasis: "Lei 9.492 arts. 27 e 31",
    legalDeadlineDays: 5,
    legalDeadlineNote: "Lei 9.492 art. 27",
    requiresPurpose: false,
    documents: ["Documento de identidade do requerente"],
  },

  // Registro de Títulos e Documentos
  {
    id: "rtd-registro-documento",
    attribution: "RTD",
    name: "Registro de documento ou contrato",
    processingMode: "online",
    legalBasis: "Lei 6.015 arts. 127 a 130",
    requiresPurpose: false,
    documents: [
      "Documento ou contrato a registrar",
      "Documento de identidade do apresentante",
    ],
    parameter: "transactionValue",
  },
  {
    id: "rtd-notificacao",
    attribution: "RTD",
    name: "Notificação extrajudicial",
    processingMode: "online",
    legalBasis: "Lei 6.015 art. 160",
    requiresPurpose: false,
    documents: ["Texto da notificação", "Dados do notificado"],
  },
  {
    id: "rtd-certidao",
    attribution: "RTD",
    name: "Certidão do registro",
    processingMode: "online",
    identificationOnly: true,
    legalBasis: "Lei 6.015 art. 17 (norma geral)",
    legalDeadlineDays: 5,
    legalDeadlineNote:
      "Lei 6.015 art. 19, red. Lei 14.382/2022: demais certidões",
    requiresPurpose: false,
  },

  // Registro Civil das Pessoas Jurídicas
  {
    id: "rcpj-registro-constituicao",
    attribution: "RCPJ",
    name: "Registro de constituição (estatuto, ata, contrato)",
    processingMode: "online",
    legalBasis: "Lei 6.015 arts. 114 a 121",
    requiresPurpose: false,
    documents: [
      "Ato constitutivo assinado",
      "Documento de identidade dos representantes",
    ],
  },
  {
    id: "rcpj-averbacao",
    attribution: "RCPJ",
    name: "Averbação de alterações",
    processingMode: "online",
    legalBasis: "Lei 6.015 arts. 114 a 121",
    requiresPurpose: false,
    documents: ["Ata ou instrumento de alteração"],
  },
  {
    id: "rcpj-certidao",
    attribution: "RCPJ",
    name: "Certidão do registro",
    processingMode: "online",
    identificationOnly: true,
    legalBasis: "Lei 6.015 art. 17 (norma geral)",
    legalDeadlineDays: 5,
    legalDeadlineNote:
      "Lei 6.015 art. 19, red. Lei 14.382/2022: demais certidões",
    requiresPurpose: false,
    parameter: "registryYears",
  },
];

// An act outside the catalogue still has a legal basis: the general rule of
// its own attribution, not "none".
const GENERAL_RULE: Record<Attribution, string> = {
  RCPN: "Lei 6.015 art. 29",
  NOTAS: "Lei 8.935 art. 7",
  RI: "Lei 6.015 art. 167",
  PROTESTO: "Lei 9.492 art. 1",
  RTD: "Lei 6.015 art. 127",
  RCPJ: "Lei 6.015 art. 114",
};

const OTHER_PREFIX = "outros-";

/**
 * The "anything else" entry, one per attribution. A catalogue that accepts
 * only what it already lists sends the unusual case back to the counter, and
 * that is the case that most needed the site. Generated, not written out six
 * times by hand.
 */
export function otherAct(attribution: Attribution): Act {
  return {
    id: `${OTHER_PREFIX}${attribution.toLowerCase()}`,
    attribution,
    name: "Outro ato desta área",
    processingMode: "online",
    legalBasis: `${GENERAL_RULE[attribution]} (norma geral); cabimento avaliado pela serventia`,
    requiresPurpose: false,
    requiresDescription: true,
  };
}

/**
 * Acts of a single attribution, empty when the office does not hold it. The
 * "anything else" entry closes the list, so the citizen sees every way in and
 * not only the named ones.
 */
export function actsOfAttribution(
  tenant: Tenant,
  attribution: Attribution,
): Act[] {
  if (!tenant.attributions.includes(attribution)) return [];
  return [
    ...ACTS.filter((a) => a.attribution === attribution),
    otherAct(attribution),
  ];
}

/** Every act available to the office, across all attributions it holds. */
export function actsOfTenant(tenant: Tenant): Act[] {
  return tenant.attributions.flatMap((a) => actsOfAttribution(tenant, a));
}

export function getAct(id: string): Act | undefined {
  if (id.startsWith(OTHER_PREFIX)) {
    const attribution = id.slice(OTHER_PREFIX.length).toUpperCase();
    return (ATTRIBUTIONS as readonly string[]).includes(attribution)
      ? otherAct(attribution as Attribution)
      : undefined;
  }
  return ACTS.find((a) => a.id === id);
}

/**
 * The act, but only when the office holds its attribution. The wizard takes
 * the act id from the URL, so this is the check that stops one office's link
 * from opening an act another office does not perform.
 */
export function getActForTenant(tenant: Tenant, id: string): Act | undefined {
  const act = getAct(id);
  if (!act || !tenant.attributions.includes(act.attribution)) return undefined;
  return act;
}
