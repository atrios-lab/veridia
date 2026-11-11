import { z } from "zod";
import { integerInWords } from "../money/extenso.ts";
import type {
  RequerimentoDocument,
  RequerimentoSection,
} from "../request/requerimento.ts";
import { PAPER_KINDS, type PaperKind } from "../security-paper/stock.ts";
import { holderName, officialName } from "../tenant/identification.ts";
import type { Tenant } from "../tenant/schema.ts";
import { formatMoneyBRL } from "../transparency/bulletin.ts";
import type { FillInput } from "./docx-model.ts";

/**
 * Solicitação de papéis de segurança (decision of 11/11/2026): the office
 * orders its security paper (and the ribbons, the labels) from the
 * suppliers it uses, each with its own form. The suppliers and their
 * items are the office's to edit: the printer may change one day. Every
 * order becomes a paper in the supplier's pattern, to sign digitally or by
 * hand, and, when the supplier's Word form is on file, that form filled.
 */

const text = (max: number) => z.string().trim().max(max).default("");

export const SupplierItemSchema = z.object({
  /** Stable within the supplier, so an order line knows its item. */
  id: z.string().trim().min(1).max(60),
  /** As the form prints it ("Traslado", "Certidão RCPN"). */
  name: z.string().trim().min(1).max(120),
  unit: z.string().trim().min(1).max(40).default("Folhas"),
  minimum: z.number().int().min(0).max(1_000_000).default(0),
  unitPriceCents: z
    .number()
    .int()
    .min(0)
    .max(100_000_000)
    .nullable()
    .default(null),
  /** "750 etiquetas cada", "Impressora Argox Plus 214". */
  note: text(200),
  /** The papel de segurança kind it restocks: the low-stock warning links here. */
  paperKind: z.enum(PAPER_KINDS).nullable().default(null),
});
export type SupplierItem = z.infer<typeof SupplierItemSchema>;

export const SupplierSchema = z.object({
  name: z.string().trim().min(2).max(160),
  cnpj: text(20),
  address: text(300),
  phone: text(60),
  email: text(160),
  website: text(160),
  /** The form's title: "Formulário de pedido", "Pedido de ribbon". */
  title: text(120),
  /** "Autorizamos a ... a efetuar o faturamento...": opens the order. */
  intro: text(2000),
  items: z.array(SupplierItemSchema).max(60).default([]),
  freightOptions: z.array(z.string().trim().min(1).max(160)).max(8).default([]),
  paymentOptions: z.array(z.string().trim().min(1).max(160)).max(8).default([]),
  delivery: text(2000),
  /** "Autorizo ainda a empresa proceder a entrega ... na sede da ANOREG". */
  deliveryAddress: text(2000),
  /** The supplier's notes: billing, deposits, contacts. */
  conditions: text(5000),
  signatureNote: text(160),
});
export type Supplier = z.infer<typeof SupplierSchema>;

/** The office as the orders present it; all editable. */
export const OfficeOrderDataSchema = z.object({
  office: text(200),
  cns: text(20),
  holderName: text(160),
  holderCpf: text(20),
  billingCnpj: text(20),
  billingCpf: text(20),
  address: text(300),
  cep: text(12),
  city: text(120),
  phone: text(60),
  email: text(160),
});
export type OfficeOrderData = z.infer<typeof OfficeOrderDataSchema>;

export function defaultOfficeOrderData(
  tenant: Tenant,
  cnpj = "",
): OfficeOrderData {
  const digits = cnpj.replace(/\D/g, "");
  return {
    office: officialName(tenant),
    cns: tenant.cns,
    holderName: holderName(tenant) ?? "",
    holderCpf: digits.length === 11 ? cnpj : "",
    billingCnpj: digits.length === 14 ? cnpj : "",
    billingCpf: "",
    address: tenant.address ?? "",
    cep: (tenant.address ?? "").match(/\d{5}-?\d{3}/)?.[0] ?? "",
    city: `${tenant.location.city}/${tenant.location.state}`,
    phone: tenant.contacts.phone ?? "",
    email: tenant.contacts.email ?? "",
  };
}

/** What is missing for an order to go out complete. */
export function officeDataMissing(d: OfficeOrderData): string[] {
  return [
    !d.office && "o nome do cartório",
    !d.cns && "o CNS",
    !d.address && "o endereço",
    !d.billingCnpj && !d.billingCpf && "o CNPJ (ou CPF) de faturamento",
    !d.holderName && "o nome do responsável",
  ].filter((v): v is string => Boolean(v));
}

/**
 * The two suppliers of the ANOREG/RN's forms (decision of 11/11/2026), as
 * a start: their texts and items as printed, all editable. The office's
 * own data never comes from here.
 */
export const STARTER_SUPPLIERS: Supplier[] = [
  {
    name: "Indústria Gráfica Brasileira Ltda (IGB)",
    cnpj: "61.418.141/0001-13",
    address: "Al. Caiapós, 525, Tamboré, Barueri/SP, CEP 06460-110",
    phone: "(11) 4166-2300",
    email: "vendas@igb.com.br",
    website: "www.igb.com.br",
    title: "Formulário de pedido",
    intro: "",
    items: [
      {
        id: "traslado",
        name: "Traslado",
        unit: "Folhas",
        minimum: 1000,
        unitPriceCents: null,
        note: "",
        paperKind: "traslado",
      },
      {
        id: "certidao-rcpn",
        name: "Certidão RCPN",
        unit: "Folhas",
        minimum: 1000,
        unitPriceCents: null,
        note: "",
        paperKind: "certidao-rcpn",
      },
      {
        id: "extensor",
        name: "Extensor de Documentos",
        unit: "Folhas",
        minimum: 1000,
        unitPriceCents: null,
        note: "",
        paperKind: null,
      },
      {
        id: "apostila",
        name: "Apostila da Haia",
        unit: "Folhas",
        minimum: 500,
        unitPriceCents: null,
        note: "",
        paperKind: "apostila",
      },
      {
        id: "etiquetas",
        name: "Etiquetas 89x48",
        unit: "Rolos",
        minimum: 2,
        unitPriceCents: null,
        note: "750 etiquetas cada",
        paperKind: "etiqueta",
      },
    ],
    freightOptions: ["Frete FOB", "Frete CIF até a sede da ANOREG/RN"],
    paymentOptions: ["Boleto, 21 ddl", "Outros"],
    delivery:
      "Os materiais serão entregues até 15 dias após a confirmação no endereço da serventia.",
    deliveryAddress: "",
    conditions:
      "A cobrança será efetuada através de boleto bancário que seguirá juntamente com a nota fiscal no e-mail cadastrado e na caixa com os produtos. Em caso de dúvida, entrar em contato com cobranca@igb.com.br.",
    signatureNote: "(Somente) titular ou substituto",
  },
  {
    name: "M2 Soluções e Tecnologia Ltda",
    cnpj: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    title: "Pedido de ribbon",
    intro:
      "Autorizamos a M2 Soluções e Tecnologia Ltda a efetuar o faturamento das unidades especificadas abaixo.",
    items: [
      {
        id: "ribbon",
        name: "Ribbon misto premium 110mm x 74m",
        unit: "Unidades",
        minimum: 0,
        unitPriceCents: 2763,
        note: "Impressora Argox Plus 214",
        paperKind: null,
      },
    ],
    freightOptions: [],
    paymentOptions: [],
    delivery: "",
    deliveryAddress:
      "Autorizo ainda a empresa proceder a entrega do referido material na sede da ANOREG/RN, situada na Rua Altino Vicente de Paiva, 231, Monte Castelo, Parnamirim/RN, CEP 59146-270.",
    conditions:
      "Para pedido com valores até R$ 60,00 (sessenta reais), efetuar o depósito na conta da empresa e enviar o comprovante junto com o pedido. Para valores acima de R$ 60,00, o pedido poderá ser faturado para 21 ddl.",
    signatureNote: "(Somente) titular ou substituto",
  },
];

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/**
 * The papel de segurança kind an item restocks, guessed from its name, for
 * an item read from a form: "Certidão RCPN" restocks the civil registry's.
 */
export function guessPaperKind(name: string): PaperKind | null {
  const n = normalize(name);
  if (n.includes("traslado")) return "traslado";
  if (n.includes("rcpn") || n.includes("registro civil"))
    return "certidao-rcpn";
  if (n.includes("apostila")) return "apostila";
  if (n.includes("etiqueta")) return "etiqueta";
  if (/\b(dut|atpv)\b/.test(n)) return "dut";
  if (n.includes("certid")) return "certidao";
  return null;
}

/** Same item, whatever the accents and the case. */
export const sameItem = (a: string, b: string) =>
  normalize(a).replace(/\s+/g, " ").trim() ===
  normalize(b).replace(/\s+/g, " ").trim();

/** "traslado", "certidao-rcpn": an id from a name, unique in the list. */
export function itemId(name: string, taken: readonly string[]): string {
  const base =
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "item";
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  return id;
}

/* ------------------------------------------------------------------ order */

export const OrderLineSchema = z.object({
  /** The supplier's item, or null for one typed only in this order. */
  itemId: z.string().max(60).nullable(),
  name: z.string().trim().min(1).max(120),
  unit: z.string().trim().min(1).max(40),
  minimum: z.number().int().min(0).default(0),
  quantity: z.number().int().min(1).max(10_000_000),
  unitPriceCents: z
    .number()
    .int()
    .min(0)
    .max(100_000_000)
    .nullable()
    .default(null),
  note: text(200),
});
export type OrderLine = z.infer<typeof OrderLineSchema>;

export const OrderInputSchema = z.object({
  lines: z.array(OrderLineSchema).min(1).max(60),
  freight: text(160),
  payment: text(160),
  notes: text(5000),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  signer: z.number().int().min(0).max(50).default(0),
});
export type OrderInput = z.infer<typeof OrderInputSchema>;

/** Why the order cannot go: a line under the supplier's minimum. */
export function orderProblems(lines: readonly OrderLine[]): string[] {
  return lines
    .filter((l) => l.minimum > 0 && l.quantity < l.minimum)
    .map(
      (l) =>
        `${l.name}: o mínimo é ${l.minimum.toLocaleString("pt-BR")} ${l.unit.toLowerCase()}.`,
    );
}

export const lineTotal = (l: Pick<OrderLine, "quantity" | "unitPriceCents">) =>
  l.unitPriceCents === null ? null : l.quantity * l.unitPriceCents;

export function orderTotal(lines: readonly OrderLine[]): number | null {
  if (lines.every((l) => l.unitPriceCents === null)) return null;
  return lines.reduce((sum, l) => sum + (lineTotal(l) ?? 0), 0);
}

export const ORDER_STATUSES = ["rascunho", "enviado", "recebido"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  rascunho: "Gerado, não enviado",
  enviado: "Enviado à empresa",
  recebido: "Recebido",
};

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
] as const;

export function writtenDate(iso: string): string {
  return `${Number(iso.slice(8, 10))} de ${MONTHS[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`;
}

/** "1.000", "07" (the forms print a roll count in two digits). */
export function formatQuantity(n: number): string {
  return n < 10 ? String(n).padStart(2, "0") : n.toLocaleString("pt-BR");
}

const mark = (chosen: string, option: string) =>
  `(${chosen === option ? "X" : " "}) ${option}`;

/** The order as the supplier's paper, on the office's letterhead. */
export function buildOrderDocument(
  tenant: Tenant,
  input: {
    number: string;
    supplier: Supplier;
    order: OrderInput;
    office: OfficeOrderData;
    signer?: { name: string; title: string; note?: string };
  },
): RequerimentoDocument {
  const { supplier: s, order, office: o } = input;
  const priced = order.lines.some((l) => l.unitPriceCents !== null);
  const total = orderTotal(order.lines);
  const officeName = o.office || officialName(tenant);
  const holder = holderName(tenant);
  const signer = input.signer?.name.trim()
    ? input.signer
    : holder
      ? { name: holder, title: tenant.holderTitle ?? "Tabelião/Registrador" }
      : undefined;

  const sections: RequerimentoSection[] = [
    {
      heading: "Empresa",
      rows: [
        { label: "Razão social", value: s.name },
        ...(s.cnpj ? [{ label: "CNPJ", value: s.cnpj }] : []),
        ...(s.address ? [{ label: "Endereço", value: s.address }] : []),
        ...([s.phone, s.email].filter(Boolean).length
          ? [
              {
                label: "Contato",
                value: [s.phone, s.email, s.website]
                  .filter(Boolean)
                  .join(" · "),
              },
            ]
          : []),
      ],
    },
    {
      heading: "Pedido",
      paragraphs: [
        s.intro ||
          `${officeName} solicita a ${s.name} o fornecimento dos itens abaixo, nas condições indicadas.`,
      ],
      table: {
        columns: [
          { label: "Item", weight: 2.6 },
          { label: "Quantidade", align: "right" },
          { label: "Unidade", weight: 0.9 },
          { label: "Mínimo", align: "right", weight: 0.9 },
          ...(priced
            ? [
                { label: "Valor unit.", align: "right" as const },
                { label: "Total", align: "right" as const },
              ]
            : []),
        ],
        rows: order.lines.map((l) => [
          l.note ? `${l.name} (${l.note})` : l.name,
          l.quantity.toLocaleString("pt-BR"),
          l.unit,
          l.minimum ? l.minimum.toLocaleString("pt-BR") : "-",
          ...(priced
            ? [
                l.unitPriceCents === null
                  ? "-"
                  : `R$ ${formatMoneyBRL(l.unitPriceCents)}`,
                lineTotal(l) === null
                  ? "-"
                  : `R$ ${formatMoneyBRL(lineTotal(l) ?? 0)}`,
              ]
            : []),
        ]),
        total:
          priced && total !== null
            ? [
                "Valor total do pedido",
                "",
                "",
                "",
                "",
                `R$ ${formatMoneyBRL(total)}`,
              ]
            : undefined,
      },
    },
  ];
  const terms: string[] = [];
  if (s.freightOptions.length) {
    terms.push(
      `Frete: ${s.freightOptions.map((f) => mark(order.freight, f)).join("   ")}`,
    );
  }
  if (s.paymentOptions.length) {
    terms.push(
      `Pagamento: ${s.paymentOptions.map((f) => mark(order.payment, f)).join("   ")}`,
    );
  }
  if (s.delivery) terms.push(`Prazo de entrega: ${s.delivery}`);
  if (s.deliveryAddress) terms.push(s.deliveryAddress);
  if (terms.length) sections.push({ heading: "Condições", paragraphs: terms });
  if (s.conditions) {
    sections.push({
      heading: "Observações da empresa",
      paragraphs: [s.conditions],
    });
  }
  if (order.notes) {
    sections.push({
      heading: "Observações do cartório",
      paragraphs: [order.notes],
    });
  }
  sections.push({
    heading: "Dados do cartório",
    rows: [
      { label: "Cartório", value: officeName },
      ...(o.cns ? [{ label: "CNS", value: o.cns }] : []),
      ...(o.holderName ? [{ label: "Responsável", value: o.holderName }] : []),
      ...(o.holderCpf ? [{ label: "CPF", value: o.holderCpf }] : []),
      ...(o.address
        ? [
            {
              label: "Endereço",
              value: o.cep ? `${o.address}, CEP ${o.cep}` : o.address,
            },
          ]
        : []),
      ...(o.city ? [{ label: "Município", value: o.city }] : []),
      ...(o.phone ? [{ label: "Fone", value: o.phone }] : []),
      ...(o.email ? [{ label: "E-mail", value: o.email }] : []),
    ],
  });
  sections.push({
    heading: "Dados de faturamento",
    rows: [
      ...(o.billingCnpj ? [{ label: "CNPJ", value: o.billingCnpj }] : []),
      ...(o.billingCpf ? [{ label: "CPF", value: o.billingCpf }] : []),
      ...(!o.billingCnpj && !o.billingCpf
        ? [{ label: "CNPJ", value: "Não informado" }]
        : []),
    ],
  });

  return {
    eyebrow: `Pedido nº ${input.number}`,
    title: s.title || "Pedido de papel de segurança",
    subtitle: s.name,
    office: [officialName(tenant), tenant.subtitle],
    sections,
    dateLine: `${tenant.location.city}/${tenant.location.state}, ${writtenDate(order.orderDate)}.`,
    signee: signer?.name || undefined,
    signature: [
      signer?.title || tenant.holderTitle || "Tabelião/Registrador",
      ...(s.signatureNote ? [s.signatureNote] : []),
    ],
    footer: `${officialName(tenant)} · Pedido nº ${input.number} · ${tenant.legalFooter}`,
  };
}

/** What the supplier's Word form receives, to be filled like the PDF. */
export function fillInputOf(input: {
  supplier: Supplier;
  order: OrderInput;
  office: OfficeOrderData;
  city: string;
}): FillInput {
  const { supplier, order, office: o } = input;
  const date = writtenDate(order.orderDate);
  const byItem = new Map(
    order.lines.filter((l) => l.itemId).map((l) => [l.itemId, l]),
  );
  const pricedItems = supplier.items.filter((i) => i.unitPriceCents !== null);
  const pricedLine =
    pricedItems.length === 1
      ? order.lines.find((l) => l.itemId === pricedItems[0]?.id)
      : undefined;
  return {
    fields: {
      cartorio: o.office,
      cns: o.cns,
      cpf: o.holderCpf,
      cpfFaturamento: o.billingCpf,
      cnpj: o.billingCnpj,
      endereco: o.address,
      cep: o.cep,
      municipio: o.city,
      fone: o.phone,
      email: o.email,
      nome: o.holderName,
      data: date.toUpperCase(),
    },
    // Every item of the form: the ones not ordered are cleared.
    items: supplier.items.map((item) => {
      const line = byItem.get(item.id);
      return {
        label: item.name,
        quantity: line ? formatQuantity(line.quantity) : "",
      };
    }),
    dateLine: `${input.city}, ${date}`,
    priced:
      pricedLine && pricedLine.unitPriceCents !== null
        ? {
            quantity: pricedLine.quantity,
            words: integerInWords(pricedLine.quantity),
            unitPrice: formatMoneyBRL(pricedLine.unitPriceCents),
            total: formatMoneyBRL(
              pricedLine.quantity * pricedLine.unitPriceCents,
            ),
          }
        : undefined,
  };
}
