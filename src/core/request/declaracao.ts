import type { Act } from "../acts/catalog.ts";
import {
  ANEXO_I_ACT_OPTIONS,
  ANEXO_I_DATA_PROTECTION,
  ANEXO_I_FINGERPRINT_NOTE,
  ANEXO_I_LEGAL_BASIS,
  ANEXO_I_NOTICE,
  ANEXO_I_ON_BEHALF_STATEMENT,
  ANEXO_I_PRESENCE_CERTIFICATION,
  ANEXO_I_REPRESENTATIVE_STATEMENT,
  CERTIFICATE_TYPE_LABELS,
  CERTIFICATE_TYPES,
  FEE_EXEMPTION_ACKNOWLEDGEMENTS,
  FEE_EXEMPTION_DECLARATION,
  PLATFORM_COUNTER_STATEMENT,
  PLATFORM_FOOTER_LINE,
  PLATFORM_MOTTO,
  PLATFORM_RECEIPT_STATEMENT,
  PLATFORM_STATEMENT,
} from "../acts/catalog.ts";
import type { Tenant } from "../tenant/schema.ts";
import { acceptanceHash } from "./acceptance.ts";
import type { ExemptionBeneficiary, ExemptionDeclaration } from "./kinds.ts";

/**
 * One labelled slot a person fills by hand: a small caption, then either the
 * value the pedido already carries (printed on the line) or nothing
 * (leaving the line blank, the same invitation the printed Anexo I makes).
 * `width` is how many of a three-column grid this field spans in the row it
 * shares with the fields next to it in the same `fields` content; absent
 * fields in one row split the row evenly.
 */
export interface FormField {
  label: string;
  value?: string;
  width?: 1 | 2 | 3;
}

/** One option of a checklist content, with an optional set of sub-options
 * indented under it (the tipo de certidão under the item "Certidão…"). */
export interface FormChecklistItem {
  checked: boolean;
  label: string;
  sub?: { checked: boolean; label: string }[];
}

/**
 * The pieces a bloco of the Anexo I is built from, in the order they are
 * drawn. Every bloco is a list of these, so the same renderer draws all
 * nine blocos and the certification stamp without switching on the bloco
 * number anywhere.
 */
export type FormContent =
  | { type: "fields"; columns: FormField[] }
  | { type: "checklist"; items: FormChecklistItem[] }
  | { type: "paragraph"; text: string; emphasis?: boolean }
  /** The five ciências, a) through e): the renderer letters them. */
  | { type: "list"; items: string[] }
  | { type: "signature"; label: string; value?: string }
  | { type: "fingerprint"; text: string }
  /** The boxed "Livro/Folha/Termo" beside bloco 3's checklist. */
  | { type: "aside"; heading: string; fields: FormField[] };

export interface FormBlock {
  number: number;
  heading: string;
  /** "Somente se houver", "Preenchimento da serventia"... shown beside the
   * heading, the way the Anexo I annotates who fills each bloco. */
  hint?: string;
  content: FormContent[];
}

/**
 * The certification stamp: what the platform, not the Anexo I, certifies
 * about how the declaração reached the serventia. Only ever attached to a
 * declaração built from a real pedido (see `DeclaracaoMeta.stamp`); the
 * blank form never carries one.
 */
export interface DeclaracaoStamp {
  heading: string;
  /** "Emitida pela plataforma · Não integra o Anexo I": what keeps this
   * box from being read as one more bloco of the official form. */
  badge: string;
  facts: { label: string; value: string }[];
  paragraphs: string[];
  /** Absent prints the line with a blank space after the label, never a
   * value invented in place of one the system never recorded. */
  hash?: string;
  ip?: string;
  motto: string;
}

export interface DeclaracaoDocument {
  kind: "declaracao";
  office: string[];
  /** "Anexo I · Provimento CGJ/TJRN n. 7/2026", shown where the letterhead
   * would otherwise leave the top-right corner empty. */
  annex: string;
  /** Absent on the blank form: the timbre's "Nº do pedido" line then prints
   * with nothing after it, for whoever fills the paper by hand. */
  protocolNumber?: string;
  eyebrow: string;
  title: string;
  /** Repeated, shorter, at the top of every page from the second on. */
  continuationTitle: string;
  continuationSubtitle: string;
  notice: { heading: string; text: string };
  blocks: FormBlock[];
  dataProtection: string;
  /** Only present when the document was built from a pedido. */
  stamp?: DeclaracaoStamp;
  legalBasis: string;
  /** One line for the blank form; the legal basis plus the platform's own
   * line when the document came from a pedido. */
  footer: string[];
}

export interface DeclaracaoMeta {
  protocolNumber?: string;
  createdAt?: Date;
  /**
   * One stamp per beneficiário, in the same order `buildDeclaracoes` walks
   * them. Built by the caller (`src/lib/request-documents.ts`, `buildStamp`
   * below), because only it holds the tenant slug, the channel and the
   * accepted IP together with the pedido. Absent (or `undefined` at an
   * index) means no certification is printed: the blank form, or a
   * "declaracao-em-branco" reprint of a real pedido.
   */
  stamps?: (DeclaracaoStamp | undefined)[];
}

/**
 * The Anexo I do Provimento CGJ/TJRN n. 7/2026, for one beneficiary of a
 * gratuidade act, as content. `exemption` absent, or its `beneficiaries` too
 * short for `beneficiaryIndex`, renders the same nine blocos with every
 * field blank: the same document the office hands anyone who asks for it
 * before filing a pedido (`buildDeclaracoes` below calls it that way).
 *
 * `act` is the gratuidade entry (`exemptionTargets` in hand), not the target
 * act: only the gratuidade entry knows every act the law isenta, which is
 * what bloco 3 marks. The requested one, if any, is found inside.
 */
export function buildDeclaracao(
  tenant: Tenant,
  act: Act,
  exemption: ExemptionDeclaration | undefined,
  beneficiaryIndex: number,
  meta: DeclaracaoMeta = {},
): DeclaracaoDocument {
  const beneficiary: ExemptionBeneficiary | undefined =
    exemption?.beneficiaries[beneficiaryIndex];
  const targets = act.exemptionTargets ?? [];
  const requested = targets.find((target) => target.id === exemption?.actId);
  const hasPedido = Boolean(exemption);

  const blocks: FormBlock[] = [];

  // Bloco 1: dados da serventia.
  blocks.push({
    number: 1,
    heading: "Dados da serventia",
    hint: "Preenchimento da serventia",
    content: [
      {
        type: "fields",
        columns: [
          { label: "Serventia", value: tenant.name, width: 2 },
          { label: "Município/Comarca", value: tenant.municipality, width: 1 },
        ],
      },
    ],
  });

  // Bloco 2: dados da pessoa beneficiária.
  blocks.push({
    number: 2,
    heading: "Dados da pessoa beneficiária",
    hint: "A pessoa que receberá a gratuidade",
    content: [
      {
        type: "fields",
        columns: [{ label: "Nome completo", value: beneficiary?.name }],
      },
      {
        type: "fields",
        columns: [
          { label: "CPF ou RG", value: beneficiary?.cpfOrId },
          { label: "Data de nascimento", value: beneficiary?.birthDate },
        ],
      },
      {
        type: "fields",
        columns: [
          { label: "Profissão", value: beneficiary?.occupation },
          { label: "Telefone ou e-mail", value: beneficiary?.contact },
        ],
      },
      {
        type: "fields",
        columns: [
          {
            label: "Endereço (rua, número, bairro)",
            value: beneficiary?.address,
          },
        ],
      },
      {
        type: "fields",
        columns: [
          { label: "Município/UF", value: beneficiary?.cityState },
          { label: "CEP", value: beneficiary?.zip },
        ],
      },
    ],
  });

  // Bloco 3: qual ato, e o tipo de certidão quando o ato pedido o pergunta
  // (Anexo I, art. 3º §1º). "Outro ato" nunca marca: o catálogo não oferece
  // esse alvo online nem no balcão.
  blocks.push({
    number: 3,
    heading: "Qual ato precisa ser gratuito?",
    hint: "Marque o ato solicitado",
    content: [
      {
        type: "checklist",
        items: ANEXO_I_ACT_OPTIONS.map((option) => ({
          checked: hasPedido && option.actId === requested?.id,
          label: option.label,
          sub:
            option.actId === "rcpn-certidao"
              ? CERTIFICATE_TYPES.map((value) => ({
                  checked: hasPedido && exemption?.certificateType === value,
                  label: CERTIFICATE_TYPE_LABELS[value],
                }))
              : undefined,
        })),
      },
      {
        type: "fields",
        columns: [{ label: "Descreva o ato e a finalidade (se necessário)" }],
      },
      // Desenhado à direita de tudo que vem antes dele (ver `drawBlockBody`
      // em `src/lib/pdf-form.ts`): a lista e a descrição ficam na coluna da
      // esquerda, o Livro/Folha/Termo em caixa na da direita.
      {
        type: "aside",
        heading: "Para localizar o ato (se souber)",
        fields: [{ label: "Livro" }, { label: "Folha" }, { label: "Termo" }],
      },
    ],
  });

  // Bloco 4: a declaração e as cinco ciências, na letra do Anexo I.
  blocks.push({
    number: 4,
    heading: "Declaração",
    content: [
      { type: "paragraph", text: FEE_EXEMPTION_DECLARATION, emphasis: true },
      { type: "paragraph", text: "Declaro, ainda, que estou ciente de que:" },
      { type: "list", items: [...FEE_EXEMPTION_ACKNOWLEDGEMENTS] },
    ],
  });

  // Bloco 5: local, data e assinatura da pessoa interessada. Sempre em
  // branco quanto a local/data: é quando e onde o papel é assinado, não o
  // instante do aceite eletrônico, que vive só no carimbo (ver `buildStamp`).
  // A impressão digital não fica aqui: no Anexo I ela é do bloco 7.
  blocks.push({
    number: 5,
    heading: "Local, data e assinatura da pessoa interessada",
    content: [
      { type: "fields", columns: [{ label: "Local e data" }] },
      {
        type: "signature",
        label:
          "Assinatura da pessoa beneficiária (ou pelo Gov.br, assinador.iti.br)",
        value: beneficiary?.signedBy === "self" ? beneficiary.name : undefined,
      },
    ],
  });

  // Bloco 6: só quando alguém assina como representante legal: condicional
  // na versão gerada do pedido, sempre presente (em branco) no formulário
  // avulso, como no oficial.
  if (!hasPedido || beneficiary?.signedBy === "legal-representative") {
    blocks.push({
      number: 6,
      heading: "Representante legal ou assistente",
      hint: "Somente se houver",
      content: [
        {
          type: "fields",
          columns: [
            { label: "Nome completo", value: beneficiary?.signer?.name },
          ],
        },
        {
          type: "fields",
          columns: [
            { label: "CPF ou RG", value: beneficiary?.signer?.cpfOrId },
            {
              label: "Telefone ou e-mail",
              value: beneficiary?.signer?.contact,
            },
          ],
        },
        {
          type: "fields",
          columns: [
            {
              label:
                "Qualidade em que atua (Ex.: responsável legal, tutor, curador ou assistente)",
              value: beneficiary?.signer?.capacity,
            },
          ],
        },
        {
          type: "fields",
          columns: [
            {
              label: "Documento comprobatório",
              value: beneficiary?.signer?.proofDocument,
            },
          ],
        },
        { type: "paragraph", text: ANEXO_I_REPRESENTATIVE_STATEMENT },
        {
          type: "signature",
          label: "Assinatura do representante legal ou assistente",
        },
      ],
    });
  }

  // Bloco 7: só quando a declaração é assinada a rogo, mesma regra do 6.
  if (!hasPedido || beneficiary?.signedBy === "on-behalf") {
    blocks.push({
      number: 7,
      heading: "Assinatura a rogo",
      hint: "Se a pessoa não souber ou não puder assinar",
      content: [
        { type: "paragraph", text: ANEXO_I_ON_BEHALF_STATEMENT },
        {
          type: "fields",
          columns: [
            {
              label: "Nome de quem assina a rogo",
              value: beneficiary?.signer?.name,
              width: 2,
            },
            {
              label: "CPF ou RG",
              value: beneficiary?.signer?.cpfOrId,
              width: 1,
            },
          ],
        },
        {
          type: "fields",
          columns: [
            {
              label: "Telefone ou e-mail",
              value: beneficiary?.signer?.contact,
            },
          ],
        },
        { type: "signature", label: "Assinatura a rogo" },
        { type: "fingerprint", text: ANEXO_I_FINGERPRINT_NOTE },
      ],
    });
  }

  // Bloco 8: testemunhas, só colhidas no balcão; sempre presente (em branco
  // em qualquer outro caso, inclusive a rogo pelo site, onde só quem assina
  // é conhecido no momento do preenchimento).
  const witnesses = beneficiary?.witnesses;
  const witnessRow = (index: 0 | 1) => ({
    type: "fields" as const,
    columns: [
      {
        label: `Testemunha ${index + 1} · Nome`,
        value: witnesses?.[index]?.name,
        width: 2 as const,
      },
      {
        label: "CPF ou RG",
        value: witnesses?.[index]?.cpfOrId,
        width: 1 as const,
      },
      {
        label: "Telefone ou e-mail",
        value: witnesses?.[index]?.contact,
        width: 1 as const,
      },
    ],
  });
  blocks.push({
    number: 8,
    heading: "Testemunhas da assinatura a rogo",
    hint: "Somente se houver assinatura a rogo",
    content: [witnessRow(0), witnessRow(1)],
  });

  // Bloco 9: sempre em branco. É o oficial quem certifica a presença, à mão,
  // no momento em que as assinaturas são colhidas.
  blocks.push({
    number: 9,
    heading: "Certificação da presença",
    hint: "Preenchimento da serventia",
    content: [
      { type: "paragraph", text: ANEXO_I_PRESENCE_CERTIFICATION },
      {
        type: "fields",
        columns: [{ label: "Local e data" }, { label: "Oficial ou preposto" }],
      },
      {
        type: "fields",
        columns: [{ label: "Assinatura e identificação funcional" }],
      },
    ],
  });

  const stamp = meta.stamps?.[beneficiaryIndex];
  const title = "Declaração de hipossuficiência econômica";

  return {
    kind: "declaracao",
    office: [
      tenant.name,
      tenant.subtitle,
      `${tenant.contacts.phone} · ${tenant.contacts.email}`,
    ],
    annex: "Anexo I · Provimento CGJ/TJRN n. 7/2026",
    protocolNumber: meta.protocolNumber,
    eyebrow: "Registro Civil das Pessoas Naturais",
    title,
    continuationTitle: title,
    continuationSubtitle:
      "Assinaturas e complementos: preencha os blocos 6 a 8 apenas " +
      "quando se aplicarem ao caso.",
    notice: ANEXO_I_NOTICE,
    blocks,
    dataProtection: ANEXO_I_DATA_PROTECTION,
    stamp,
    legalBasis: ANEXO_I_LEGAL_BASIS,
    footer: stamp
      ? [ANEXO_I_LEGAL_BASIS, PLATFORM_FOOTER_LINE]
      : [ANEXO_I_LEGAL_BASIS],
  };
}

/**
 * One declaração per beneficiário do ato pedido: a habilitação de casamento
 * pede duas (Provimento art. 4º), tudo o mais pede uma. Sem pedido nenhum
 * (`exemption` ausente, o formulário avulso), sempre uma só: não há como
 * saber, sem o ato escolhido, quantas a pessoa vai precisar.
 */
export function buildDeclaracoes(
  tenant: Tenant,
  act: Act,
  exemption: ExemptionDeclaration | undefined,
  meta: DeclaracaoMeta = {},
): DeclaracaoDocument[] {
  const requested = act.exemptionTargets?.find(
    (target) => target.id === exemption?.actId,
  );
  const count = requested?.feeExemption?.beneficiaryCount ?? 1;
  return Array.from({ length: count }, (_, index) =>
    buildDeclaracao(tenant, act, exemption, index, meta),
  );
}

/** "A própria pessoa", "Representante legal: <nome>" ou "A rogo: <nome>": o
 * fato "Formalizada por" do carimbo. */
function formalizedByLabel(
  beneficiary: ExemptionBeneficiary | undefined,
): string {
  if (!beneficiary || beneficiary.signedBy === "self") {
    return "A própria pessoa";
  }
  const name = beneficiary.signer?.name;
  if (beneficiary.signedBy === "legal-representative") {
    return name ? `Representante legal: ${name}` : "Representante legal";
  }
  return name ? `A rogo: ${name}` : "A rogo";
}

/** "Site oficial da serventia", "Balcão" ou o que quer que `details.channel`
 * traga: ver o comentário de `readChannel` em `kinds.ts`. */
function channelLabel(channel: string | undefined): string {
  if (channel === "counter") return "Balcão";
  if (channel === "chat") return "Atendimento por chat";
  return "Site oficial da serventia";
}

function formatAcceptedAt(iso: string): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Fortaleza",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Fortaleza",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return `${day} às ${time}`;
}

export interface BuildStampInput {
  tenantSlug: string;
  protocolNumber: string;
  /** Raw `details.channel` (see `readChannel`): undefined means the site. */
  channel: string | undefined;
  exemption: ExemptionDeclaration;
  beneficiaryIndex: number;
}

/**
 * The certification stamp for one beneficiário's declaração: everything the
 * platform can say with truth about how it received this aceite, plus a
 * hash anyone holding the pedido can recompute. Reads only what the pedido
 * already carries; it never invents a channel, a name or an address that
 * was not recorded.
 *
 * The hash is of the whole pedido's `beneficiaries`, not of
 * `beneficiaryIndex` alone: a habilitação de casamento is one aceite, made
 * once, that produces two declarações (one per nubente, art. 4º); both
 * carimbos print the same hash on purpose, because they certify the same
 * moment of acceptance, not two separate ones.
 */
export function buildStamp(input: BuildStampInput): DeclaracaoStamp {
  const beneficiary = input.exemption.beneficiaries[input.beneficiaryIndex];
  // Ausente é o site (ver `readChannel`); qualquer outro valor é a serventia
  // lançando o pedido, e nada chegou eletronicamente do cidadão.
  const online = input.channel === undefined;
  const hash = acceptanceHash({
    tenantSlug: input.tenantSlug,
    protocolNumber: input.protocolNumber,
    declaredAt: input.exemption.declaredAt,
    actId: input.exemption.actId,
    certificateType: input.exemption.certificateType,
    beneficiaries: input.exemption.beneficiaries,
  });
  return {
    heading: online
      ? "Certificação de recebimento eletrônico"
      : "Certificação de registro na plataforma",
    badge: "Emitida pela plataforma · Não integra o Anexo I",
    facts: [
      { label: "Canal", value: channelLabel(input.channel) },
      {
        label: "Recebida em",
        value: formatAcceptedAt(input.exemption.declaredAt),
      },
      { label: "Formalizada por", value: formalizedByLabel(beneficiary) },
      { label: "Protocolo", value: input.protocolNumber },
    ],
    paragraphs: [
      online ? PLATFORM_RECEIPT_STATEMENT : PLATFORM_COUNTER_STATEMENT,
      PLATFORM_STATEMENT,
    ],
    hash,
    ip: input.exemption.acceptance?.ip,
    motto: PLATFORM_MOTTO,
  };
}
