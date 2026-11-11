import { type GuideKind, OFFERED_GUIDE_KINDS } from "./schema.ts";

/**
 * Every guia the Utilitários issue, what each one calls its parties, which
 * fisco reads it and the law it rests on. Each legal citation here was read
 * in the official consolidated text (Senado Federal's legislation base, which
 * carries the Câmara's compiled text, and the Assembleia Legislativa do RN);
 * see docs/guias-de-recolhimento.md for the sources. The municipal law and
 * rate are the office's own (settings), because each town has its own.
 */

export type Fisco = "municipal" | "estadual";

export interface GuideKindInfo {
  label: string;
  /** The tax or the request, as the paper's subtitle names it. */
  subject: string;
  fisco: Fisco;
  /** How the transmitting and the acquiring party are named. */
  roles: { transmitente: string; adquirente: string };
  /** Natures offered in the form; free text is accepted too. */
  natures: string[];
  /** How the amount is reached: a fixed rate, the RN's ITCD table, none. */
  rate: "fixed" | "itcd-rn" | "none";
  /** The national law the guia cites, ahead of the local one. */
  legalBasis: string[];
}

export const GUIDE_KIND_INFO: Record<GuideKind, GuideKindInfo> = {
  itiv: {
    label: "ITIV / ITBI",
    subject:
      "Imposto sobre a Transmissão Inter Vivos de Bens Imóveis (ITIV/ITBI)",
    fisco: "municipal",
    roles: {
      transmitente: "Transmitente (vendedor)",
      adquirente: "Adquirente (comprador)",
    },
    natures: [
      "compra e venda",
      "permuta",
      "dação em pagamento",
      "cessão de direitos",
    ],
    rate: "fixed",
    legalBasis: [
      "Constituição Federal, art. 156, II",
      "Código Tributário Nacional, arts. 35, 38, 41 e 42 (redação da Lei Complementar nº 227/2026)",
    ],
  },
  "itcd-doacao": {
    label: "ITCD / ITCMD (doação)",
    subject:
      "Imposto sobre a Transmissão Causa Mortis e Doação (ITCD), por doação",
    fisco: "estadual",
    roles: { transmitente: "Doador(a)", adquirente: "Donatário(a)" },
    natures: [
      "doação",
      "doação com reserva de usufruto",
      "doação de nua-propriedade",
    ],
    rate: "itcd-rn",
    legalBasis: [
      "Constituição Federal, art. 155, I",
      "Lei Estadual nº 5.887, de 15 de fevereiro de 1989, art. 7º, com a redação da Lei nº 9.993, de 29 de outubro de 2015",
    ],
  },
  "itcd-causa-mortis": {
    label: "ITCD / ITCMD (causa mortis)",
    subject:
      "Imposto sobre a Transmissão Causa Mortis e Doação (ITCD), causa mortis",
    fisco: "estadual",
    roles: {
      transmitente: "Autor(a) da herança",
      adquirente: "Herdeiro(a) ou legatário(a)",
    },
    natures: [
      "inventário e partilha extrajudicial",
      "adjudicação",
      "cessão de direitos hereditários",
    ],
    rate: "itcd-rn",
    legalBasis: [
      "Constituição Federal, art. 155, I",
      "Lei Estadual nº 5.887, de 15 de fevereiro de 1989, art. 7º, com a redação da Lei nº 9.993, de 29 de outubro de 2015",
    ],
  },
  "laudemio-municipal": {
    label: "Laudêmio municipal",
    subject: "Laudêmio devido ao Município (imóvel foreiro)",
    fisco: "municipal",
    roles: { transmitente: "Alienante (foreiro)", adquirente: "Adquirente" },
    natures: ["compra e venda", "dação em pagamento"],
    rate: "fixed",
    legalBasis: [
      "Código Civil de 1916, art. 686 (2,5% sobre o preço da alienação, se outro não se fixou no título de aforamento)",
      "Código Civil de 2002, art. 2.038, § 1º, I (vedado o laudêmio sobre construções e plantações)",
    ],
  },
  "certidao-imobiliaria": {
    label: "Certidão de débitos imobiliários (IPTU)",
    subject: "Certidão dos tributos que incidem sobre o imóvel (IPTU)",
    fisco: "municipal",
    roles: { transmitente: "Proprietário(a)", adquirente: "Adquirente" },
    natures: ["compra e venda", "doação", "permuta", "inventário e partilha"],
    rate: "none",
    legalBasis: [
      "Lei nº 7.433/1985, art. 1º, § 2º",
      "Decreto nº 93.240/1986, art. 1º, III, a, e § 2º (dispensável pelo adquirente, que responde pelos débitos)",
    ],
  },
};

/**
 * The RN's ITCD, Lei 5.887/1989, art. 7º (Lei 9.993/2015): each rate on
 * the part of the base inside its bracket, not on the whole base.
 */
export const ITCD_RN_BRACKETS: {
  upToCents: number | null;
  basisPoints: number;
}[] = [
  { upToCents: 500_000_00, basisPoints: 300 },
  { upToCents: 1_000_000_00, basisPoints: 400 },
  { upToCents: 3_000_000_00, basisPoints: 500 },
  { upToCents: null, basisPoints: 600 },
];

export interface BracketPart {
  fromCents: number;
  toCents: number;
  basisPoints: number;
  taxCents: number;
}

/** The ITCD on a base, bracket by bracket, rounded to the cent. */
export function itcdRn(baseCents: number): {
  taxCents: number;
  parts: BracketPart[];
} {
  const parts: BracketPart[] = [];
  let from = 0;
  for (const bracket of ITCD_RN_BRACKETS) {
    if (baseCents <= from) break;
    const to =
      bracket.upToCents === null
        ? baseCents
        : Math.min(baseCents, bracket.upToCents);
    const taxCents = Math.round(((to - from) * bracket.basisPoints) / 10_000);
    parts.push({
      fromCents: from,
      toCents: to,
      basisPoints: bracket.basisPoints,
      taxCents,
    });
    if (bracket.upToCents === null) break;
    from = bracket.upToCents;
  }
  return {
    taxCents: parts.reduce((sum, part) => sum + part.taxCents, 0),
    parts,
  };
}

/**
 * What the Utilitários show for a property of the União (terreno de marinha):
 * no guia comes out of the office, the party settles it at the SPU. Every
 * item read in the Decreto-Lei 2.398/1987 as consolidated.
 */
export const SPU_STEPS: { title: string; detail: string }[] = [
  {
    title: "Laudêmio federal (DARF)",
    detail:
      "Pago pelo vendedor antes da transferência: 5% do valor atualizado do domínio pleno do terreno, excluídas as benfeitorias (Decreto-Lei nº 2.398/1987, art. 3º, caput, redação da Lei nº 13.465/2017). O cálculo é pedido à SPU (art. 3º, § 3º).",
  },
  {
    title: "Certidão da SPU (CAT)",
    detail:
      "Sem ela o cartório não lavra nem registra a escritura (art. 3º, § 2º, I): declara o laudêmio recolhido, o transmitente em dia com o Patrimônio da União e a transferência autorizada.",
  },
  {
    title: "Transferência cadastral em 60 dias",
    detail:
      "Concluída a transmissão, o adquirente pede à SPU a transferência dos registros em até 60 dias (art. 3º, § 4º); depois disso, multa de 0,50% por mês ou fração sobre o valor do terreno, excluídas as benfeitorias (art. 3º, § 5º).",
  },
  {
    title: "DOITU pelo cartório",
    detail:
      "O cartório declara à SPU cada operação com terreno da União até o último dia útil do mês seguinte ao da lavratura (art. 3º-A, § 1º).",
  },
];

export const SPU_LINKS: { label: string; href: string }[] = [
  {
    label: "Calcular o laudêmio (gov.br)",
    href: "https://www.gov.br/pt-br/servicos/calcular-laudemio",
  },
  {
    label: "Emitir a Certidão de Autorização para Transferência, CAT (gov.br)",
    href: "https://www.gov.br/pt-br/servicos/emitir-a-certidao-de-autorizacao-para-transferencia-cat",
  },
  {
    label: "Transferir o responsável pelo imóvel no cadastro da SPU (gov.br)",
    href: "https://www.gov.br/pt-br/servicos/transferir-titular-de-imovel-da-uniao",
  },
];

/**
 * What the "Guias de transmissão de bens" are, in one line, from the catalogue itself
 * (decision of 11/11/2026): a kind added to `GUIDE_KIND_INFO` and offered
 * shows up here with no other edit, so the name never pins a single tax.
 */
export function guideKindsSummary(
  kinds: readonly GuideKind[] = OFFERED_GUIDE_KINDS,
): string {
  // Mid-sentence: "laudêmio municipal", but "ITIV / ITBI" stays as is.
  const labels = kinds.map((kind) => {
    const label = GUIDE_KIND_INFO[kind].label;
    return /^[A-ZÀ-Ú][a-zà-ú]/.test(label)
      ? label.charAt(0).toLowerCase() + label.slice(1)
      : label;
  });
  const list =
    labels.length <= 1
      ? labels.join("")
      : `${labels.slice(0, -1).join(", ")} e ${labels.at(-1)}`;
  return `Tributos e pedidos ao fisco na transmissão de bens (imóveis, móveis e digitais), por compra e venda, doação ou herança: ${list}.`;
}
