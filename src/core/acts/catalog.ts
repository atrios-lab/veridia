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
 * The attribution as a sigla, for a table cell or a filter chip where even
 * the short name is too long. The official acronyms stay as they are; the
 * two that read as words (Notas, Protesto) take title case, the way the
 * office writes them.
 */
export const ATTRIBUTION_ACRONYMS: Record<Attribution, string> = {
  RCPN: "RCPN",
  NOTAS: "Notas",
  RI: "RI",
  PROTESTO: "Protesto",
  RTD: "RTD",
  RCPJ: "RCPJ",
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

/**
 * The promise each mode makes, phrased for someone outside the trade. Both
 * labels say where the act *ends*, because pedir sempre dá pelos dois lados:
 * qualquer ato pode ser pedido no balcão também, e o selo que só dizia
 * "on-line" ou "on-line + presencial" foi lido como se dissesse onde se pede.
 * A serventia leu assim primeiro; o cidadão leria depois.
 */
export const PROCESSING_MODE_LABELS: Record<ProcessingMode, string> = {
  online: "Termina on-line",
  presential: "Termina no balcão",
};

export const PROCESSING_MODE_HINTS: Record<ProcessingMode, string> = {
  online: "você assina pelo Gov.br e não precisa ir à serventia",
  presential: "você adianta aqui, mas precisa comparecer para concluir",
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
   * Marking it does two things: it puts the act among the ones the gratuidade
   * entry offers, and it makes the attribution show that entry at all.
   *
   * The basis is per act because they are different laws, and it is here for
   * the same reason `legalDeadlineNote` is: so the next person can check the
   * citation instead of trusting it.
   *
   * `beneficiaryCount` is how many separate declarations the act needs
   * (Provimento CGJ/TJRN n. 7/2026, art. 4º: individual per beneficiary). Two
   * only for the habilitação de casamento, where each nubente is a
   * beneficiary of their own. `askCertificateType` marks the one act (the
   * certidão) whose Anexo I bloco 3 asks which kind of certidão, sem busca,
   * com busca ou inteiro teor.
   */
  feeExemption?: {
    legalBasis: string;
    beneficiaryCount: 1 | 2;
    askCertificateType?: true;
  };
  /**
   * Só a entrada da gratuidade tem: os atos daquela atribuição que a lei
   * isenta, que é o que ela pergunta ao cidadão. Vive no ato, e não numa
   * consulta ao catálogo, porque quem valida é `publicServiceRequestSchema`,
   * e um import de valor dali para cá fecha o ciclo
   * `pix -> form -> catalog -> tenant/schema -> pix`.
   */
  exemptionTargets?: Act[];
}

/**
 * The kinds of certidão the Anexo I bloco 3 offers, for the one act whose
 * `feeExemption.askCertificateType` is set. Same three words the form uses:
 * sem busca (the register already knows book/folha/termo), com busca (the
 * office has to find it) and inteiro teor (the full text, not the summary).
 */
export const CERTIFICATE_TYPES = [
  "sem-busca",
  "com-busca",
  "inteiro-teor",
] as const;
export type CertificateType = (typeof CERTIFICATE_TYPES)[number];

export const CERTIFICATE_TYPE_LABELS: Record<CertificateType, string> = {
  "sem-busca": "Sem busca",
  "com-busca": "Com busca",
  "inteiro-teor": "Inteiro teor",
};

/**
 * What the requester declares to ask for the exemption: the bloco 4 of the
 * Anexo I (Provimento CGJ/TJRN n. 7/2026), not a proof of enrollment in any
 * federal programme. The declaration alone is enough (art. 5º): nothing here
 * names a benefit or a system to check it against, because the Provimento
 * forbids presuming poverty from anything but the declaration itself
 * (art. 6º).
 *
 * It rides in the declaração de hipossuficiência the citizen signs
 * (`src/core/request/declaracao.ts`), so the wording is the office's to
 * confirm, not this file's to invent quietly.
 *
 * `acceptanceHash` (`src/core/request/acceptance.ts`) hashes this text
 * alongside every aceite: changing the wording here changes every hash
 * computed from this moment on, and a hash printed on a declaração issued
 * before the change can no longer be recomputed against today's text. That
 * is intentional (the hash proves *which* text was accepted), but it means
 * this string is not a place to fix a typo quietly; keep the old wording
 * reachable if a hash printed before a change ever needs to be checked.
 */
export const FEE_EXEMPTION_DECLARATION =
  "Declaro, sob as penas da lei, que não disponho de recursos suficientes " +
  "para suportar os emolumentos do ato indicado sem prejuízo de minha " +
  "manutenção e da manutenção de minha família.";

/**
 * The five things the Anexo I bloco 4 makes the declarant acknowledge,
 * alongside the declaration above, in the order the form lists them
 * (Provimento CGJ/TJRN n. 7/2026, arts. 11 e 9º).
 */
export const FEE_EXEMPTION_ACKNOWLEDGEMENTS = [
  "havendo fundadas razões para dúvida quanto à veracidade desta declaração, " +
    "o registrador poderá suscitar a questão ao juízo competente, inclusive " +
    "para eventual substituição da gratuidade pelo parcelamento",
  "mesmo nessa hipótese, o ato será praticado de imediato, " +
    "independentemente de prévia decisão sobre a gratuidade",
  "se o benefício for posteriormente indeferido, poderão ser adotadas " +
    "medidas extrajudiciais para cobrança dos emolumentos devidos",
  "a prestação de informação falsa poderá gerar responsabilidade civil e " +
    "criminal",
  "salvo previsão legal em sentido diverso, a gratuidade não abrange " +
    "serviços postais, remessas de documentos, diligências ou notificações",
] as const;

/**
 * The notice at the top of the Anexo I ("Antes de preencher"), word for word
 * as the DJe published it: who this form is for, and who it is not for.
 * Shown once, on the printed form; the online wizard says the same thing in
 * its own voice on the screen (`request-form.tsx`), which is not this
 * string's job to match.
 */
export const ANEXO_I_NOTICE = {
  heading: "Antes de preencher",
  text:
    "Use este formulário somente quando a gratuidade depender da " +
    "insuficiência de recursos. Não é exigido para atos gratuitos " +
    "independentemente de renda nem para atos abrangidos por decisão " +
    "judicial. Preencha um formulário para cada pessoa beneficiária.",
};

/**
 * The data-protection notice between blocos 5 and 6 (Provimento CGJ/TJRN
 * n. 7/2026, art. 13): the declaração is kept apart from the assento and
 * never travels with a certidão issued to a third party.
 */
export const ANEXO_I_DATA_PROTECTION =
  "As informações serão tratadas apenas para processamento do pedido, " +
  "cumprimento de obrigação legal e eventual comunicação, com acesso " +
  "restrito. Este formulário fica arquivado em separado, não integra o " +
  "assento nem acompanha certidões expedidas a terceiros (Provimento " +
  "n. 7/2026, art. 13; Lei n. 13.709/2018).";

/**
 * The four options bloco 3 offers, in the order and the wording the Anexo I
 * prints them, each paired with the catalogue act it marks. `actId: null` is
 * "Outro ato com previsão legal": no act in the catalogue ever marks it, the
 * same restraint `otherAct` already takes for the wizard (see the Non-Goals
 * of `redesenhar-declaracao-com-carimbo`): the paper form keeps the option
 * because the printed Anexo I has it, the online pedido does not offer it.
 */
export interface AnexoIActOption {
  actId: string | null;
  label: string;
}

export const ANEXO_I_ACT_OPTIONS: AnexoIActOption[] = [
  {
    actId: "rcpn-certidao",
    label: "Certidão de nascimento, casamento, óbito ou outra",
  },
  {
    actId: "rcpn-habilitacao-casamento",
    label: "Habilitação, registro do casamento e primeira certidão",
  },
  {
    actId: "rcpn-alteracao-prenome",
    label:
      "Alteração extrajudicial de prenome e gênero (Retificação e " +
      "Averbação), inclusive certidões correspondentes",
  },
  { actId: null, label: "Outro ato com previsão legal" },
];

/** Bloco 6, printed above the representative's signature line, word for
 * word. */
export const ANEXO_I_REPRESENTATIVE_STATEMENT =
  "Declaro que atuo em nome ou em assistência da pessoa beneficiária e " +
  "que as informações econômicas prestadas se referem à situação dessa " +
  "pessoa.";

/** Bloco 7, printed above who signs a rogo, word for word. */
export const ANEXO_I_ON_BEHALF_STATEMENT =
  "A pedido da pessoa beneficiária, assino a presente declaração a rogo.";

/** The note beside the fingerprint box in bloco 7: a missing fingerprint
 * never blocks the declaração from being accepted. */
export const ANEXO_I_FINGERPRINT_NOTE =
  "Impressão digital da pessoa beneficiária, quando possível. A ausência " +
  "não impede o recebimento da declaração.";

/** Bloco 9, the office's own certification, word for word: it is the
 * office's oficial who writes this by hand, never the system. */
export const ANEXO_I_PRESENCE_CERTIFICATION =
  "Certifico e dou fé que as assinaturas e/ou a impressão digital foram " +
  "apostas em minha presença, após a identificação das pessoas " +
  "signatárias, ficando concedida a gratuidade para a prática do ato " +
  'solicitado. No ato praticado constará apenas a expressão "isento de ' +
  'emolumentos", sem referência à situação econômica da pessoa ' +
  "interessada.";

/**
 * The normative basis at the foot of the Anexo I, exactly as the DJe printed
 * it, in its order: the veridia rodapé used to cite its own shorter list
 * (Lei 6.015 art. 30 only) and that was never what the office hands out.
 */
export const ANEXO_I_LEGAL_BASIS =
  "Provimento CNJ n. 221/2026 · Provimento CGJ/RN n. 07/2026 (Anexo I) · " +
  "Lei Estadual n. 11.038/2021, art. 45, I a VII · Lei Federal " +
  "n. 6.015/1973, art. 30, §§ 1º, 2º, 3º e 4º · Código de Normas CGJ/RN " +
  "- Caderno Extrajudicial · Código de Processo Civil, art. 98, IX · " +
  "Lei n. 13.709/2018 (LGPD)";

/**
 * The certification stamp's own texts: what the platform, not the Anexo I,
 * says about how the declaração reached the serventia. None of these cites
 * Provimento CGJ/TJRN n. 7/2026 as the authorisation for the platform
 * itself: the 7/2026 disciplines the declaração's content, the Provimento
 * CNJ n. 180/2024 is what authorises the serventia's own site as a channel
 * (art. 208, II, "b", do Código Nacional de Normas do CNJ, Foro
 * Extrajudicial), and no one has pointed at an article of the 7/2026 that
 * says otherwise. Saying so would be a citation this file cannot back.
 */
export const PLATFORM_RECEIPT_STATEMENT =
  "Declaração recebida eletronicamente pela Plataforma Eletrônica Oficial " +
  "da Serventia, mediante aceite do texto integral do Anexo I do " +
  "Provimento CGJ/TJRN nº 7/2026 pela pessoa beneficiária.";

/** The counter's version of the line above: nothing was received
 * electronically from the citizen there. The operator recorded, on the
 * platform, a declaração made in person, and the paper the person signs
 * (blocos 5 a 9) is the aceite. */
export const PLATFORM_COUNTER_STATEMENT =
  "Declaração registrada pela serventia na Plataforma Eletrônica Oficial " +
  "a partir do atendimento presencial, com o texto integral do Anexo I do " +
  "Provimento CGJ/TJRN nº 7/2026 apresentado à pessoa beneficiária.";

export const PLATFORM_STATEMENT =
  "Plataforma própria da serventia para solicitação e acompanhamento de " +
  'serviços eletrônicos, nos termos do art. 208, II, "b", do Código ' +
  "Nacional de Normas da Corregedoria Nacional de Justiça - Foro " +
  "Extrajudicial, com redação dada pelo Provimento CNJ nº 180/2024, que " +
  "admite a utilização de sistema ou plataforma própria da serventia.";

export const PLATFORM_MOTTO =
  "Autenticidade • Integridade • Segurança • Rastreabilidade";

/** The declaração's own second rodapé line, added only when the document
 * came from a pedido (never on the blank form: there is nothing to certify
 * about a form nobody filed). */
export const PLATFORM_FOOTER_LINE =
  "Documento expedido pela Plataforma Eletrônica Oficial da Serventia · " +
  "Provimento CNJ nº 180/2024 · Dados tratados conforme a LGPD " +
  "(Lei nº 13.709/2018)";

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
      legalBasis: "Lei 6.015 art. 30 §1º e §2º; Provimento CGJ/TJRN n. 7/2026",
      beneficiaryCount: 1,
      askCertificateType: true,
    },
  },
  {
    id: "rcpn-habilitacao-casamento",
    attribution: "RCPN",
    name: "Habilitação de casamento",
    processingMode: "online",
    legalBasis: "Lei 6.015 art. 67 (CC art. 1.525)",
    requiresPurpose: false,
    feeExemption: {
      legalBasis: "CC art. 1.512, parágrafo único",
      beneficiaryCount: 2,
    },
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
    name: "Alteração de prenome",
    processingMode: "presential",
    legalBasis: "Lei 6.015 art. 56 (Lei 14.382/2022)",
    requiresPurpose: false,
    guidance:
      "Comparecimento pessoal do interessado com documento de identidade. " +
      "O pedido é imotivado: você não precisa justificar a alteração.",
    feeExemption: {
      legalBasis:
        "Lei 6.015 art. 30 §1º; Provimento CGJ/TJRN n. 7/2026, Anexo I",
      beneficiaryCount: 1,
    },
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
const EXEMPTION_PREFIX = "gratuidade-";

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
 * The acts of an attribution that the law exempts, which is what the
 * gratuidade entry offers the citizen to choose from. Empty means the
 * attribution has no exemption foreseen, and then the entry does not exist.
 */
export function exemptableActs(
  tenant: Tenant,
  attribution: Attribution,
): Act[] {
  if (!tenant.attributions.includes(attribution)) return [];
  return ACTS.filter((a) => a.attribution === attribution && a.feeExemption);
}

/**
 * The way in for someone who arrives knowing only that they are exempt. One
 * per attribution, generated like `otherAct`: the act being asked for is a
 * question inside the form, not a different door.
 *
 * No `legalDeadlineDays` of its own: the term is the one the requested act
 * carries, so an exempt certidão is not born with a different term than a paid
 * one (see `deadlineDaysForRequest`).
 */
export function exemptionAct(attribution: Attribution): Act {
  return {
    id: `${EXEMPTION_PREFIX}${attribution.toLowerCase()}`,
    attribution,
    name: "Solicitar gratuidade (isento)",
    processingMode: "online",
    legalBasis: "CF art. 5º, LXXVI; conferida pela serventia",
    requiresPurpose: false,
    exemptionTargets: ACTS.filter(
      (a) => a.attribution === attribution && a.feeExemption,
    ),
  };
}

/**
 * Acts of a single attribution, empty when the office does not hold it. The
 * gratuidade entry comes before the "anything else" one, and only where some
 * act of the attribution is exemptable; both close the list, so the citizen
 * sees every way in and not only the named ones.
 */
export function actsOfAttribution(
  tenant: Tenant,
  attribution: Attribution,
): Act[] {
  if (!tenant.attributions.includes(attribution)) return [];
  return [
    ...ACTS.filter((a) => a.attribution === attribution),
    ...(exemptableActs(tenant, attribution).length > 0
      ? [exemptionAct(attribution)]
      : []),
    otherAct(attribution),
  ];
}

/** Every act available to the office, across all attributions it holds. */
export function actsOfTenant(tenant: Tenant): Act[] {
  return tenant.attributions.flatMap((a) => actsOfAttribution(tenant, a));
}

export function getAct(id: string): Act | undefined {
  for (const [prefix, build] of [
    [OTHER_PREFIX, otherAct],
    [EXEMPTION_PREFIX, exemptionAct],
  ] as const) {
    if (!id.startsWith(prefix)) continue;
    const attribution = id.slice(prefix.length).toUpperCase();
    return (ATTRIBUTIONS as readonly string[]).includes(attribution)
      ? build(attribution as Attribution)
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
