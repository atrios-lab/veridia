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
  PROTESTO: "Protesto de títulos, certidão e cancelamento",
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
  "hybrid", // started online, finished at the counter or online, either way
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
  hybrid: "Termina no balcão ou on-line",
};

/**
 * O que se assina pelo Gov.br é o requerimento, não o ato. "Você assina pelo
 * Gov.br", sem dizer o quê, fazia parecer que a assinatura concluía até um ato
 * público, e o ato notarial eletrônico só se assina no e-Notariado (CNN, art.
 * 286, III). Um ato assim traz a própria dica em `processingHint`.
 */
export const PROCESSING_MODE_HINTS: Record<ProcessingMode, string> = {
  online: "você assina o requerimento pelo Gov.br e não precisa ir à serventia",
  presential: "você adianta aqui, mas precisa comparecer para concluir",
  hybrid: "você adianta aqui e conclui no balcão ou pela internet",
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
  "além do requerimento assinado, a serventia só pede a sua identificação";

/**
 * A dica que acompanha o selo de um ato. A própria do ato vem primeiro: no
 * inteiro teor em papel, a de "Só identificação" esconderia que é preciso ir
 * ao balcão. Quem tem as duas coisas a dizer diz as duas em `processingHint`.
 */
export function processingHintFor(
  act: Pick<Act, "processingMode" | "identificationOnly" | "processingHint">,
): string {
  return (
    act.processingHint ??
    (act.identificationOnly
      ? IDENTIFICATION_ONLY_HINT
      : PROCESSING_MODE_HINTS[act.processingMode])
  );
}

/**
 * O aviso do inteiro teor do RCPN, igual no site e no balcão. Avisa e não
 * decide: quem diz se a autorização judicial é necessária é a serventia, depois
 * de receber o pedido. Conferido no texto compilado do CNN no site do CNJ em
 * 07/11/2026: art. 114 (mandatário com poderes especiais; terceiro com dado
 * sensível só com autorização), art. 116 §§ 2º e 3º (dados restritos e
 * sigilosos) e art. 529 § 1º (pessoa trans). Não cita artigo para o texto do
 * site não envelhecer com uma renumeração.
 */
export const REQUESTER_QUALIFICATION_NOTICE =
  "Alguns registros têm dados sensíveis, restritos ou sigilosos, como adoção, " +
  "reconhecimento de filho, mudança de nome ou sexo de pessoa trans e mudança " +
  "de nome de testemunha protegida. A certidão desses registros só sai com " +
  "autorização judicial quando quem pede não é o interessado, o representante " +
  "legal ou um procurador com poderes especiais. Na mudança de nome ou sexo de " +
  "pessoa trans, só a própria pessoa pede sem ordem judicial. O pedido é " +
  "analisado depois do recebimento e pode ser recusado se faltar o mandato ou " +
  "outro documento necessário.";

/**
 * O campo do motivo, igual no site e no balcão. O inteiro teor reproduz o
 * registro por completo, com o que ele tiver de adoção, reconhecimento de
 * filho, mudança de nome ou de sexo e disposições de testamento: a serventia só
 * trata esses dados para uma finalidade informada (LGPD, art. 6º, I), e o
 * motivo é o que ela confere antes de emitir. Nos dois atos de imóveis que já
 * pediam finalidade (documento arquivado e busca) o texto serve igual.
 */
export const PURPOSE_LABEL = "Motivo do pedido";
export const PURPOSE_PLACEHOLDER =
  "Ex.: comprovar atividade rural para a aposentadoria no INSS.";
export const PURPOSE_HINT =
  "O registro pode trazer dados pessoais sensíveis. Pela LGPD, a serventia só " +
  "os entrega para uma finalidade informada, e analisa o motivo antes de " +
  "responder.";

/**
 * Por que o e-Notariado não está aqui: o CNN, art. 117, lista firma reconhecida,
 * ICP-Brasil, Gov.br e assinatura conferida com o documento de identidade
 * original, e não o cita para este requerimento. O § 1º dispensa a firma do
 * requerimento assinado na frente do oficial ou do preposto, por isso o balcão
 * aparece como alternativa ao reconhecimento.
 */
export const INTEIRO_TEOR_SIGNATURE_CAVEAT =
  "Além do Gov.br, vale o certificado digital ICP-Brasil. Se assinar de próprio " +
  "punho, reconheça a firma em um cartório de notas ou assine no balcão da " +
  "serventia, com o documento de identidade original.";

/** Extra fact the office needs to find the right band in the fee table. */
export type ActParameter = "transactionValue" | "registryYears";

/**
 * One of the mutually exclusive kinds an act groups under a single name.
 *
 * `id` is what a request stores (`details.actVariant`), so it never changes
 * once shipped: a request whose id is gone falls back to the act's own name.
 * `name` is complete ("Certidão de casamento"), never a suffix, because the
 * same text is the select's option and what the panel shows in place of the
 * grouped name.
 */
export interface ActVariant {
  id: string;
  name: string;
  /** The option says too little on its own: "Outra certidão" needs the words. */
  requiresDescription?: true;
  /**
   * Dispensa as perguntas de `Act.requesterQualification`: no óbito, a restrição
   * a dado sensível não alcança a pessoa falecida (CNN, arts. 118 e 119).
   */
  waivesRequesterQualification?: true;
  /**
   * A opção pede o motivo mesmo que o ato não peça: é o inteiro teor dentro de
   * um ato que também emite certidões resumidas (imóveis, RTD, RCPJ) e o
   * testamento dentro das certidões de Notas. Quem responde é `asksPurpose`.
   */
  requiresPurpose?: true;
}

export interface ActVariants {
  /** The select's label. Neutral voice: the counter reads it too. */
  question: string;
  /** Shown as a list to pick from, every option in sight, not a select. */
  listed?: true;
  options: ActVariant[];
}

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
   * Whether the act asks the citizen why they want the document. A summary
   * certificate does not: Lei 6.015 art. 17 says it may be asked for without a
   * motive. Every inteiro teor does, because the full text carries sensitive
   * data (LGPD, art. 6º, I): in the Registro Civil the CNN, art. 117, § 3º, says
   * so; in the other attributions it is the product's decision of 07/11/2026.
   * Where the inteiro teor is one option among summaries, the option carries
   * it (`ActVariant.requiresPurpose`). `asksPurpose` is what says whether a
   * given request does.
   */
  requiresPurpose: boolean;
  /** Papers the office expects, shown as a checklist before submitting. */
  documents?: string[];
  /** Where the mode's own hint would mislead, this one is shown instead. */
  processingHint?: string;
  /**
   * O requerimento precisa dizer quem pede e por quê (CNN, art. 117, § 3º). Vale
   * só com uma opção escolhida e que não o dispense: quem responde é
   * `asksRequesterQualification`, nunca este campo sozinho.
   */
  requesterQualification?: true;
  /**
   * Quem pede escolhe receber a certidão digital, pelo site, ou impressa em
   * papel, no balcão. Pergunta de todo pedido do ato, inclusive do óbito.
   */
  deliveryChoice?: true;
  /** No lugar do aviso geral de assinatura, onde ele citaria o que não vale. */
  signatureCaveat?: string;
  /**
   * Uma consulta, não um ato a praticar: a serventia só responde. O CPF é
   * opcional, o requerimento assinado não é pedido, e no painel a entrega e o
   * andamento comum dão lugar à resposta, que conclui o pedido (decisões do
   * responsável pelo produto em 07/11/2026). O valor é facultativo: há
   * serventias que cobram a busca pela tabela de emolumentos e outras que
   * não. Quem quiser o ato depois faz um pedido novo, no ato certo.
   */
  consultation?: true;
  /**
   * What to bring and how it goes, for acts finished at the counter or signed
   * somewhere other than this site.
   */
  guidance?: string;
  /**
   * Not a price: the site never quotes one. It is the input the operator needs
   * to find the band in the court's fee table when the act is charged by band.
   */
  parameter?: ActParameter;
  /**
   * The citizen asks for a guia de recolhimento (ITIV/ITBI, ITCD...): the
   * form takes the parties, the property and the value in a short form, and
   * the guia is drawn by itself into the panel's Utilitários, for the office
   * alone to check, correct, sign and deliver with the boleto (product
   * decision of 09/11/2026). See core/guides.
   */
  taxGuide?: true;
  /** Without a description there is no way to know what was asked for. */
  requiresDescription?: boolean;
  /** The form's example, where the general one would talk about something else. */
  descriptionPlaceholder?: string;
  /**
   * Only where the options exclude each other. "Retificação de registro
   * (área, descrição)" stays out on purpose: one request may involve both.
   * Where a request can mix them, as in Pessoas Jurídicas, the mix is an option
   * of its own and the description says what goes in it.
   */
  variants?: ActVariants;
  /**
   * The act is the prenotação of a title for analysis: the request is
   * priced on filing with the prenotação item of the fee table in force for
   * this attribution (see `src/core/fees/prenotation.ts`), never with a
   * value typed in this file. A table without the item leaves the price to
   * the operator, as for every other act.
   */
  chargesPrenotation?: true;
  /**
   * Off the list, but still resolved by `getAct`: a request already filed under
   * this id keeps its name and legal basis. New requests go to the act that
   * took its place.
   */
  retired?: true;
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

/**
 * The three things the site says about the platform that the carimbo does
 * not: where electronic pedidos may come in (the rule the serventia invokes
 * to refuse one that arrives by WhatsApp or e-mail), which security
 * guidelines it follows, and how personal data is treated. Wording is the
 * serventia's own (`/plataforma`, and the rodapé for the first).
 */
export const PLATFORM_CHANNEL_RULE =
  "Nos termos do Provimento n. 180 do Conselho Nacional de Justiça (CNJ), " +
  "que disciplina o uso de plataformas eletrônicas de serviços " +
  "extrajudiciais, os pedidos de registro eletrônico devem ser realizados " +
  "exclusivamente pelas Centrais Oficiais Nacionais, reconhecidas pelo " +
  "CNJ, ou, ainda, diretamente pelo site institucional deste Cartório.";

export const PLATFORM_SECURITY_STATEMENT =
  "A plataforma observa as diretrizes de segurança, integridade, " +
  "disponibilidade, autenticidade e rastreabilidade estabelecidas pelo " +
  "Provimento CNJ n. 213/2026, com as alterações promovidas pelo " +
  "Provimento CNJ n. 243/2026.";

export const PLATFORM_DATA_PROTECTION =
  "Seus dados pessoais são protegidos e tratados em conformidade com a Lei " +
  "Geral de Proteção de Dados Pessoais (LGPD, Lei n. 13.709/2018) e com as " +
  "normas aplicáveis aos serviços extrajudiciais.";

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
/**
 * The prenotação (análise) of Imóveis, Títulos e Documentos and Pessoas
 * Jurídicas: the same five ends in the three registries, listed for the
 * citizen to pick, and the same words about what is charged now and what
 * comes after the analysis.
 */
const PRENOTATION_VARIANTS: ActVariants = {
  question: "A análise é para qual ato?",
  listed: true,
  options: [
    { id: "anotacao", name: "Prenotação para anotação" },
    { id: "averbacao", name: "Prenotação para averbação" },
    { id: "registro", name: "Prenotação para registro" },
    { id: "retificacao", name: "Prenotação para retificação" },
    { id: "ratificacao", name: "Prenotação para ratificação" },
  ],
};
const PRENOTATION_HINT =
  "você envia o título para análise e paga a prenotação agora; o ato é concluído depois da análise";
const PRENOTATION_GUIDANCE =
  "A prenotação é a entrada do título no protocolo para a análise: ela garante a ordem de apresentação. " +
  "O valor da prenotação é cobrado no pedido, junto com o requerimento assinado. " +
  "Os emolumentos da anotação, averbação, registro, retificação ou ratificação são calculados depois da análise e informados no protocolo.";

export const ACTS: Act[] = [
  // Registro Civil das Pessoas Naturais
  {
    id: "rcpn-certidao",
    attribution: "RCPN",
    name: "Certidão (nascimento, casamento, óbito)",
    variants: {
      question: "Qual certidão?",
      options: [
        { id: "nascimento", name: "Certidão de nascimento" },
        { id: "casamento", name: "Certidão de casamento" },
        // Na gratuidade com inteiro teor, o óbito também não pede o motivo
        // (CNN, arts. 118 e 119), igual ao verbum ad verbum pago.
        {
          id: "obito",
          name: "Certidão de óbito",
          waivesRequesterQualification: true,
        },
        // The Anexo I says "ou outra" too: without this, whoever needs another
        // certificate of the Registro Civil would have to mark a wrong one.
        { id: "outra", name: "Outra certidão", requiresDescription: true },
      ],
    },
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
    id: "rcpn-certidao-inteiro-teor",
    attribution: "RCPN",
    name: "Certidão de inteiro teor (verbum ad verbum)",
    variants: {
      question: "De qual registro?",
      options: [
        { id: "nascimento", name: "Certidão de nascimento em inteiro teor" },
        { id: "casamento", name: "Certidão de casamento em inteiro teor" },
        {
          id: "obito",
          name: "Certidão de óbito em inteiro teor",
          waivesRequesterQualification: true,
        },
        {
          id: "outra",
          name: "Outra certidão em inteiro teor",
          requiresDescription: true,
        },
      ],
    },
    // A serventia entrega pelo site ou imprime no balcão, e a escolha é de
    // quem pede (confirmado pelo responsável pelo produto em 07/11/2026).
    processingMode: "hybrid",
    deliveryChoice: true,
    processingHint:
      "você escolhe receber a certidão pelo site ou retirá-la impressa no balcão",
    guidance:
      "No pedido, você escolhe a certidão digital, entregue pelo site, ou " +
      "impressa em papel, retirada no balcão da serventia. Para retirar no " +
      "balcão, traga um documento de identidade.",
    legalBasis: "Lei 6.015 arts. 17 a 19; Prov. 149 arts. 114 a 119",
    legalDeadlineDays: 5,
    legalDeadlineNote:
      "Lei 6.015 art. 19, red. Lei 14.382/2022: demais certidões",
    requiresPurpose: true, // Prov. 149 art. 117 § 3º, salvo no óbito
    requesterQualification: true,
    descriptionPlaceholder:
      "Ex.: nome da pessoa registrada e, se souber, livro, folha e termo.",
    signatureCaveat: INTEIRO_TEOR_SIGNATURE_CAVEAT,
    documents: [
      "Documento de identidade do solicitante",
      "Mandato (procuração), se o pedido for por advogado ou procurador",
    ],
  },
  {
    // Uma consulta, não a certidão: quem pede quer saber se o registro está
    // nesta serventia, e às vezes o que ele diz (a profissão do registrado,
    // por exemplo), antes de decidir qual certidão pedir. Não é busca em banco
    // de dados: a serventia procura nos livros e responde pelo protocolo. Se
    // constar, a resposta manda pedir a certidão no ato certo.
    id: "rcpn-busca",
    attribution: "RCPN",
    name: "Busca de registro (consulta antes da certidão)",
    consultation: true,
    variants: {
      question: "De qual registro?",
      options: [
        { id: "nascimento", name: "Busca de registro de nascimento" },
        { id: "casamento", name: "Busca de registro de casamento" },
        { id: "obito", name: "Busca de registro de óbito" },
        { id: "outro", name: "Busca de outro registro" },
      ],
    },
    processingMode: "online",
    identificationOnly: true,
    processingHint:
      "a serventia responde se o registro consta aqui, e não exige requerimento assinado nem CPF",
    legalBasis:
      "Lei 6.015 art. 17 (norma geral); cabimento e custas da busca avaliados pela serventia",
    // O que se pergunta sobre o registro pode ser dado do inteiro teor, como a
    // profissão: o motivo é pedido, como no inteiro teor (decisão do produto
    // de 07/11/2026). Sem prazo legal: não é certidão, vale o da serventia.
    requiresPurpose: true,
    requiresDescription: true,
    descriptionPlaceholder:
      "Ex.: Paulo Neto, nascido em 1958, filho de João e Maria. Quero saber " +
      "se o registro de nascimento é desta serventia e qual profissão consta " +
      "nele: agricultor, pedreiro ou outra.",
    guidance:
      "A busca não é a certidão. A serventia procura o registro nos livros e " +
      "responde, pelo protocolo, se ele consta aqui e, quando puder, o que você " +
      "perguntou. Se constar, faça um novo pedido no ato certo: a certidão " +
      "comum ou a de inteiro teor.",
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
    variants: {
      question: "Escritura ou procuração?",
      options: [
        { id: "escritura", name: "Escritura pública" },
        { id: "procuracao", name: "Procuração" },
      ],
    },
    processingMode: "hybrid",
    processingHint:
      "você adianta aqui e assina no balcão ou no e-Notariado, por videoconferência",
    legalBasis: "Lei 8.935 art. 7 I",
    requiresPurpose: false,
    guidance:
      "No balcão, as partes comparecem com documento de identidade e CPF e " +
      "trazem os documentos do ato pretendido. On-line, a assinatura é no " +
      "e-Notariado, por videoconferência com o tabelião.",
  },
  {
    id: "notas-ata-notarial",
    attribution: "NOTAS",
    name: "Ata notarial",
    processingMode: "online",
    processingHint:
      "o requerimento é pelo Gov.br; a ata você assina no e-Notariado, por videoconferência",
    legalBasis: "Lei 8.935 art. 7 III",
    requiresPurpose: false,
    guidance:
      "A ata é assinada no e-Notariado, por videoconferência com o tabelião.",
    documents: [
      "Documento de identidade do solicitante",
      "Descrição do fato a constatar",
    ],
  },
  {
    id: "notas-guia-recolhimento",
    attribution: "NOTAS",
    name: "Guia de recolhimento de imposto (ITIV/ITBI, ITCD, laudêmio)",
    processingMode: "online",
    processingHint:
      "você informa os dados e anexa os documentos; a serventia confere, prepara a guia e devolve com o boleto",
    // O tabelião fiscaliza o recolhimento dos impostos dos atos que pratica
    // (Lei 8.935/1994, art. 30, XI) e consigna o comprovante do ITBI na
    // escritura (Lei 7.433/1985, art. 1º, § 2º).
    legalBasis: "Lei 8.935 art. 30 XI",
    requiresPurpose: false,
    taxGuide: true,
    descriptionPlaceholder:
      "Ex.: compra de uma casa no centro; a escritura será feita nesta serventia.",
    documents: [
      "Documento de identidade e CPF de cada parte",
      "Certidão de nascimento ou de casamento de cada parte",
      "Comprovante de residência",
      "Certidão de inteiro teor ou de ônus da matrícula do imóvel",
      "Carnê do IPTU (imóvel urbano) ou CCIR e ITR (imóvel rural)",
      "Planta e memorial descritivo ou levantamento topográfico, se houver",
    ],
    guidance:
      "A serventia confere os dados e os documentos, prepara a guia e a devolve assinada, com o boleto, na consulta do protocolo. O imposto é pago ao fisco (Prefeitura ou Estado), não à serventia.",
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
    name: "Certidão de ato notarial ou de testamento",
    variants: {
      question: "De qual ato?",
      options: [
        {
          id: "ato-notarial",
          name: "Certidão de escritura, procuração ou ata notarial",
        },
        // O testamento traz disposições de família e de patrimônio que o
        // testador quis guardar: o motivo é pedido, e a serventia analisa.
        {
          id: "testamento",
          name: "Certidão de testamento",
          requiresPurpose: true,
        },
      ],
    },
    processingMode: "online",
    identificationOnly: true,
    legalBasis: "Lei 8.935 art. 7 (cópia de ato lavrado)",
    requiresPurpose: false,
  },

  // Registro de Imóveis
  {
    id: "ri-certidao-matricula",
    attribution: "RI",
    name: "Certidão de matrícula, inteiro teor digital ou ônus",
    variants: {
      question: "Qual certidão?",
      options: [
        { id: "matricula", name: "Certidão de matrícula" },
        // O id ficou: os pedidos antigos passam a aparecer como digital, que é
        // o que o selo "Termina on-line" já prometia a eles.
        {
          id: "inteiro-teor",
          name: "Certidão de inteiro teor digital",
          requiresPurpose: true,
        },
        { id: "onus", name: "Certidão de ônus" },
      ],
    },
    processingMode: "online",
    identificationOnly: true,
    legalBasis: "Prov. 149 art. 123 caput",
    legalDeadlineDays: 1,
    legalDeadlineNote:
      "Lei 6.015 art. 19, red. Lei 14.382/2022: situação jurídica do imóvel. O inteiro teor tem 4 horas, que não cabe numa contagem em dias",
    // The caput asks who is requesting, never what for, and the matrícula and
    // the ônus stay that way. The inteiro teor asks the motive on its option,
    // by the product's decision of 07/11/2026, aware of Lei 6.015 art. 17: the
    // full text is where sensitive data lives. Never move it to the act, or
    // every summary certificate would be asked too.
    requiresPurpose: false,
  },
  {
    // Um ato, e não mais uma opção acima: o selo e o prazo são do ato e aparecem
    // antes de escolher a opção, e como opção o papel leria "não precisa ir à
    // serventia".
    id: "ri-certidao-inteiro-teor-papel",
    attribution: "RI",
    name: "Certidão de inteiro teor em papel de segurança",
    processingMode: "presential",
    identificationOnly: true,
    processingHint:
      "você retira a certidão impressa no balcão, e além do requerimento assinado a serventia só pede a sua identificação",
    legalBasis: "Prov. 149 art. 123 caput; Prov. CGJ/RN 156/2016 arts. 52 e 53",
    legalDeadlineDays: 5,
    legalDeadlineNote:
      "Lei 6.015 art. 19 § 10 III, red. Lei 14.382/2022: as 4 horas do inciso I são só do meio eletrônico",
    // Inteiro teor: o motivo é pedido, como no digital acima.
    requiresPurpose: true,
    guidance:
      "A certidão é impressa em papel de segurança e retirada no balcão da " +
      "serventia. Traga um documento de identidade.",
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
    variants: {
      question: "Qual indicador?",
      options: [
        { id: "pessoal", name: "Busca por indicador pessoal" },
        { id: "real", name: "Busca por indicador real" },
      ],
    },
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
    id: "ri-prenotacao",
    attribution: "RI",
    name: "Prenotação (análise): anotação, averbação, registro, retificação ou ratificação",
    variants: PRENOTATION_VARIANTS,
    processingMode: "hybrid",
    processingHint: PRENOTATION_HINT,
    guidance: PRENOTATION_GUIDANCE,
    legalBasis: "Lei 6.015 arts. 12, 182 e 186",
    // O registro ou a nota devolutiva: o resultado da análise do título.
    legalDeadlineDays: 10,
    legalDeadlineNote: "Lei 6.015 art. 188 (redação da Lei 14.382/2022)",
    requiresPurpose: false,
    chargesPrenotation: true,
    documents: [
      "Título ou documento a ser analisado, completo e legível",
      "Documento de identidade do apresentante",
    ],
  },
  {
    id: "ri-registro-titulo",
    attribution: "RI",
    name: "Registro ou averbação na matrícula",
    variants: {
      question: "Registro ou averbação?",
      options: [
        { id: "registro", name: "Registro na matrícula" },
        { id: "averbacao", name: "Averbação na matrícula" },
      ],
    },
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
    id: "protesto-titulos",
    attribution: "PROTESTO",
    name: "Protesto de títulos",
    processingMode: "online",
    legalBasis: "Lei 9.492 arts. 1 e 3",
    legalDeadlineDays: 3,
    legalDeadlineNote:
      "Lei 9.492 art. 12: conta da protocolização, em dias com expediente bancário",
    requiresPurpose: false,
    documents: [
      "Título ou documento de dívida",
      "Documentos que qualifiquem o protestante",
      "Dados que qualifiquem o devedor: nome, documento de identificação e endereço",
    ],
  },
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
    id: "rtd-prenotacao",
    attribution: "RTD",
    name: "Prenotação (análise): anotação, averbação, registro, retificação ou ratificação",
    variants: PRENOTATION_VARIANTS,
    processingMode: "hybrid",
    processingHint: PRENOTATION_HINT,
    guidance: PRENOTATION_GUIDANCE,
    legalBasis: "Lei 6.015 arts. 127 e 146",
    requiresPurpose: false,
    chargesPrenotation: true,
    documents: [
      "Título ou documento a ser analisado, completo e legível",
      "Documento de identidade do apresentante",
    ],
  },
  {
    id: "rtd-registro-documento",
    attribution: "RTD",
    name: "Registro de documento ou contrato",
    variants: {
      question: "O que será registrado?",
      options: [
        { id: "documento", name: "Registro de documento" },
        { id: "contrato", name: "Registro de contrato" },
      ],
    },
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
    name: "Certidão do registro (breve relato ou inteiro teor)",
    variants: {
      question: "Qual certidão?",
      options: [
        { id: "breve-relato", name: "Certidão em breve relato" },
        {
          id: "inteiro-teor",
          name: "Certidão de inteiro teor",
          requiresPurpose: true,
        },
      ],
    },
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
    id: "rcpj-prenotacao",
    attribution: "RCPJ",
    name: "Prenotação (análise): anotação, averbação, registro, retificação ou ratificação",
    variants: PRENOTATION_VARIANTS,
    processingMode: "hybrid",
    processingHint: PRENOTATION_HINT,
    guidance: PRENOTATION_GUIDANCE,
    legalBasis: "Lei 6.015 arts. 114 a 121",
    requiresPurpose: false,
    chargesPrenotation: true,
    documents: [
      "Título ou documento a ser analisado, completo e legível",
      "Documento de identidade do apresentante",
    ],
  },
  {
    id: "rcpj-registro-constituicao",
    attribution: "RCPJ",
    name: "Registro ou averbação (estatuto, ata, contrato)",
    variants: {
      question: "Escolha o serviço",
      options: [
        { id: "registro", name: "Registro de estatuto, ata ou contrato" },
        { id: "averbacao", name: "Averbação de estatuto, ata ou contrato" },
        { id: "misto", name: "Registro e averbação (misto)" },
      ],
    },
    processingMode: "online",
    legalBasis: "Lei 6.015 arts. 114 a 121",
    requiresPurpose: false,
    requiresDescription: true,
    descriptionPlaceholder:
      "Ex.: registrar a ata de eleição da diretoria e averbar a alteração do estatuto.",
    documents: [
      "Estatuto, ata ou contrato assinado",
      "Documento de identidade dos representantes",
    ],
  },
  {
    id: "rcpj-averbacao",
    attribution: "RCPJ",
    name: "Averbação de alterações",
    retired: true,
    processingMode: "online",
    legalBasis: "Lei 6.015 arts. 114 a 121",
    requiresPurpose: false,
    documents: ["Ata ou instrumento de alteração"],
  },
  {
    id: "rcpj-certidao",
    attribution: "RCPJ",
    name: "Certidão do registro (breve relato ou inteiro teor)",
    variants: {
      question: "Qual certidão?",
      options: [
        { id: "breve-relato", name: "Certidão em breve relato" },
        {
          id: "inteiro-teor",
          name: "Certidão de inteiro teor",
          requiresPurpose: true,
        },
      ],
    },
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
    ...ACTS.filter((a) => a.attribution === attribution && !a.retired),
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

/**
 * The name of the kind a request chose, or undefined when it chose none or the
 * id is no longer in the catalogue: every reader falls back to `act.name`, so a
 * request filed before this existed keeps its name and a raw id never shows.
 */
export function actVariantName(
  act: Pick<Act, "variants">,
  variantId: string | undefined,
): string | undefined {
  return act.variants?.options.find((option) => option.id === variantId)?.name;
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
