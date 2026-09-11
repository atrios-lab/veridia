import {
  CERTIFICATE_TYPE_LABELS,
  CERTIFICATE_TYPES,
  FEE_EXEMPTION_ACKNOWLEDGEMENTS,
  FEE_EXEMPTION_DECLARATION,
} from "../acts/catalog.ts";
import type { Act } from "../acts/catalog.ts";
import type { Tenant } from "../tenant/schema.ts";
import type { ExemptionBeneficiary, ExemptionDeclaration } from "./kinds.ts";
import type {
  RequerimentoDocument,
  RequerimentoSection,
} from "./requerimento.ts";

/**
 * A checkbox drawn as text: `drawField`/`drawSection` place plain paragraphs
 * and labelled lines, never a real form widget, so a mark that survives
 * Helvetica's standard glyphs (no ☒/☐, which the base-14 fonts do not carry)
 * is an ASCII bracket, exactly like the printed Anexo I invites someone to
 * fill by hand where the online pedido left it unmarked.
 */
function mark(checked: boolean, label: string): string {
  return `${checked ? "[X]" : "[ ]"} ${label}`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export interface DeclaracaoMeta {
  protocolNumber?: string;
  createdAt?: Date;
}

/**
 * The Anexo I do Provimento CGJ/TJRN n. 7/2026, for one beneficiary of a
 * gratuidade act, as content. `exemption` absent, or its `beneficiaries` too
 * short for `beneficiaryIndex`, renders the same nine blocks with every
 * field blank — the same document the office hands anyone who asks for it
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
): RequerimentoDocument {
  const beneficiary: ExemptionBeneficiary | undefined =
    exemption?.beneficiaries[beneficiaryIndex];
  const targets = act.exemptionTargets ?? [];
  const requested = targets.find((target) => target.id === exemption?.actId);

  const sections: RequerimentoSection[] = [
    {
      heading: "1. Dados da serventia",
      fields: [
        { label: "Serventia", value: tenant.name },
        { label: "Município/Comarca", value: tenant.municipality },
      ],
    },
    {
      heading: "2. Dados da pessoa beneficiária",
      fields: [
        { label: "Nome completo", value: beneficiary?.name },
        { label: "CPF ou RG", value: beneficiary?.cpfOrId },
        { label: "Data de nascimento", value: beneficiary?.birthDate },
        { label: "Profissão", value: beneficiary?.occupation },
        { label: "Endereço", value: beneficiary?.address },
        { label: "Município/UF", value: beneficiary?.cityState },
        { label: "CEP", value: beneficiary?.zip },
        { label: "Telefone ou e-mail", value: beneficiary?.contact },
      ],
    },
  ];

  // Bloco 3: qual ato, e o tipo de certidão quando o ato pedido o pergunta
  // (Anexo I, art. 3º §1º). Marca o pedido quando há um; sem pedido nenhum
  // (formulário em branco), toda opção sai desmarcada, para preencher à mão.
  const actMarks = targets.map((target) =>
    mark(
      target.id === requested?.id,
      `${target.name}${target.feeExemption ? ` (${target.feeExemption.legalBasis})` : ""}`,
    ),
  );
  const certificateMarks = requested?.feeExemption?.askCertificateType
    ? CERTIFICATE_TYPES.map((value) =>
        mark(exemption?.certificateType === value, CERTIFICATE_TYPE_LABELS[value]),
      )
    : [];
  sections.push({
    heading: "3. Qual ato precisa ser gratuito?",
    paragraphs: [...actMarks, ...certificateMarks],
    fields: [
      { label: "Livro" },
      { label: "Folha" },
      { label: "Termo" },
    ],
  });

  // Bloco 4: a declaração e as cinco ciências, na letra do Anexo I.
  sections.push({
    heading: "4. Declaração",
    paragraphs: [
      FEE_EXEMPTION_DECLARATION,
      "Declaro, ainda, que estou ciente de que:",
      ...FEE_EXEMPTION_ACKNOWLEDGEMENTS.map(
        (item, index) => `${String.fromCharCode(97 + index)}) ${item}`,
      ),
    ],
  });

  // Bloco 5: a assinatura da própria pessoa vive no rodapé genérico do
  // documento (`signee`/`signature`, abaixo); aqui só o que ele não desenha.
  sections.push({
    heading: "5. Local, data e assinatura da pessoa interessada",
    fields: [
      { label: "Local e data" },
      ...(beneficiary?.signedBy === "on-behalf"
        ? [{ label: "Impressão digital da pessoa beneficiária (se possível)" }]
        : []),
    ],
  });

  // Bloco 6: só quando alguém assina como representante legal.
  if (beneficiary?.signedBy === "legal-representative") {
    sections.push({
      heading: "6. Representante legal ou assistente",
      fields: [
        { label: "Nome completo", value: beneficiary.signer?.name },
        { label: "CPF ou RG", value: beneficiary.signer?.cpfOrId },
        { label: "Telefone ou e-mail", value: beneficiary.signer?.contact },
        { label: "Qualidade em que atua", value: beneficiary.signer?.capacity },
        {
          label: "Documento comprobatório",
          value: beneficiary.signer?.proofDocument,
        },
        { label: "Assinatura do representante legal" },
      ],
    });
  }

  // Bloco 7: só quando a declaração é assinada a rogo.
  if (beneficiary?.signedBy === "on-behalf") {
    sections.push({
      heading: "7. Assinatura a rogo",
      fields: [
        { label: "Nome de quem assina a rogo", value: beneficiary.signer?.name },
        { label: "CPF ou RG", value: beneficiary.signer?.cpfOrId },
        { label: "Telefone ou e-mail", value: beneficiary.signer?.contact },
        { label: "Assinatura a rogo" },
      ],
    });
  }

  // Bloco 8: testemunhas, só colhidas no balcão (ver `actRules` em
  // `form.ts`); em branco em qualquer outro caso, inclusive a rogo pelo
  // site, onde só quem assina é conhecido no momento do preenchimento.
  const witnesses = beneficiary?.witnesses;
  sections.push({
    heading: "8. Testemunhas da assinatura a rogo",
    fields: [
      { label: "Testemunha 1 · Nome", value: witnesses?.[0]?.name },
      { label: "Testemunha 1 · CPF ou RG", value: witnesses?.[0]?.cpfOrId },
      { label: "Testemunha 2 · Nome", value: witnesses?.[1]?.name },
      { label: "Testemunha 2 · CPF ou RG", value: witnesses?.[1]?.cpfOrId },
    ],
  });

  // Bloco 9: sempre em branco. É o oficial quem certifica a presença, à mão,
  // no momento em que as assinaturas são colhidas.
  sections.push({
    heading: "9. Certificação da presença",
    fields: [
      { label: "Local e data" },
      { label: "Oficial ou preposto" },
      { label: "Assinatura e identificação funcional" },
    ],
  });

  const subtitle = meta.protocolNumber
    ? `Protocolo ${meta.protocolNumber} · ${formatDate(meta.createdAt ?? new Date())}`
    : "Formulário em branco";

  return {
    eyebrow: "Registro Civil das Pessoas Naturais",
    title: "Declaração de hipossuficiência econômica",
    subtitle,
    office: [
      tenant.name,
      tenant.subtitle,
      `${tenant.contacts.phone} · ${tenant.contacts.email}`,
    ],
    sections,
    signee: beneficiary?.name,
    signature: [
      "Assine pelo Gov.br (assinador.iti.br) ou imprima e assine de " +
        "próprio punho, junto com o requerimento do ato.",
    ],
    footer:
      `${tenant.name} · Declaração de hipossuficiência · Provimento CGJ/TJRN ` +
      `n. 7/2026, Anexo I; Lei 6.015 art. 30 · ${tenant.legalFooter}`,
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
): RequerimentoDocument[] {
  const requested = act.exemptionTargets?.find(
    (target) => target.id === exemption?.actId,
  );
  const count = requested?.feeExemption?.beneficiaryCount ?? 1;
  return Array.from({ length: count }, (_, index) =>
    buildDeclaracao(tenant, act, exemption, index, meta),
  );
}
