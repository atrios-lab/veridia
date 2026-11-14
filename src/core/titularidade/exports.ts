import {
  competenceLabel,
  OPERATIONS,
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
  "ctp-xml": { label: "Carga CTP em XML", ext: "xml", type: "application/xml" },
  "ctp-json": {
    label: "Carga CTP em JSON",
    ext: "json",
    type: "application/json",
  },
  "ctp-txt": {
    label: "Carga CTP em TXT (separado por |)",
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

function partyOut(p: TransferParty) {
  return compact({
    nome: p.name,
    cpfCnpj: digits(p.taxId) || undefined,
    participacao: shareOf(p.share),
  });
}

/** One act of the Carga CTP, with the words beside the DOI codes. */
function ctpAct(t: TitleTransfer, index: number) {
  return compact({
    sequencia: index + 1,
    servico: SERVICES[t.service].label,
    ato: (SERVICES[t.service].acts as Record<string, string>)[t.act] ?? t.act,
    dataAto: t.actDate,
    livro: t.book,
    folhas: t.page,
    registroAverbacao: t.entry,
    codigoOperacaoDoi: t.operation,
    operacao:
      t.operation === "39" && t.operationOther
        ? t.operationOther
        : OPERATIONS[t.operation],
    imovel: compact({
      destinacao: t.destination,
      matricula: t.matricula,
      registroImoveis: t.registry,
      inscricaoImobiliaria: t.fiscalRegistration,
      endereco: t.address,
      descricao: t.description,
    }),
    valorDeclarado: money(t.valueCents),
    baseCalculoItbiItcmd: money(t.taxBaseCents),
    transmitentes: t.transmitentes.map(partyOut),
    adquirentes: t.adquirentes.map(partyOut),
    observacoes: t.notes,
  });
}

export function ctpObject(
  office: OfficeForExport,
  competence: string,
  transfers: TitleTransfer[],
) {
  return {
    comunicacaoTitularidade: compact({
      fundamento:
        "Código Nacional de Normas (Provimento CNJ nº 149/2023), art. 184-A; Resolução CNJ nº 547/2024, art. 4º",
      serventia: office.name,
      cns: office.cns,
      municipio: `${office.city}/${office.state}`,
      competencia: competence,
      descricaoCompetencia: competenceLabel(competence),
      semMovimento: transfers.length === 0,
      quantidadeAtos: transfers.length,
      atos: transfers.map(ctpAct),
    }),
  };
}

export function ctpJson(
  office: OfficeForExport,
  competence: string,
  transfers: TitleTransfer[],
): string {
  return `${JSON.stringify(ctpObject(office, competence, transfers), null, 2)}\n`;
}

export function ctpXml(
  office: OfficeForExport,
  competence: string,
  transfers: TitleTransfer[],
): string {
  return toXml(ctpObject(office, competence, transfers), {
    atos: "ato",
    transmitentes: "transmitente",
    adquirentes: "adquirente",
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

function doiParty(p: TransferParty) {
  const ni = digits(p.taxId);
  const share = shareOf(p.share);
  return compact({
    indicadorNiIdentificado: ni.length > 0,
    // DOI "Tabela 10": 2 = não consta no documento.
    motivoNaoIdentificacaoNi: ni ? undefined : "2",
    ni: ni || undefined,
    nome: p.name,
    participacao: share,
    indicadorNaoConstaParticipacaoOperacao:
      share === undefined ? true : undefined,
    indicadorEspolio: /^esp[óo]lio\b/i.test(p.name) || undefined,
  });
}

/** One DOI declaration from an act, in the DOI-Web's field names. */
export function doiDeclaration(t: TitleTransfer) {
  const notas = t.service === "notas";
  return {
    ...compact({
      tipoServico: notas ? "1" : "2",
      dataLavraturaRegistroAverbacao: t.actDate,
      tipoAto: ACT_CODE[t.act],
      tipoLivro: notas ? undefined : t.matricula ? "1" : undefined,
      numeroLivro: notas ? t.book : undefined,
      folha: notas ? t.page : undefined,
      matricula: notas ? undefined : digits(t.matricula) || undefined,
      numeroRegistroAverbacao: notas ? undefined : t.entry,
    }),
    operacaoImobiliaria: compact({
      dataNegocioJuridico: t.actDate,
      tipoOperacaoImobiliaria: t.operation,
      descricaoOutrasOperacoesImobiliarias:
        t.operation === "39" ? t.operationOther.slice(0, 30) : undefined,
      valorOperacaoImobiliaria: money(t.valueCents),
      indicadorNaoConstaValorOperacaoImobiliaria:
        t.valueCents === null ? true : undefined,
      valorBaseCalculoItbiItcmd: money(t.taxBaseCents),
      indicadorNaoConstaValorBaseCalculoItbiItcmd:
        t.taxBaseCents === null ? true : undefined,
    }),
    imovel: compact({
      // DOI "Tabela 9": 1 urbano, 3 rural.
      destinacao:
        t.destination === "rural"
          ? "3"
          : t.destination === "urbano"
            ? "1"
            : undefined,
      matricula: digits(t.matricula) || undefined,
      inscricaoMunicipal: t.fiscalRegistration,
      ...(t.destination === "rural" ? {} : addressParts(t.address)),
      denominacao:
        t.destination === "rural" ? t.description.slice(0, 200) : undefined,
    }),
    alienantes: t.transmitentes.map(doiParty),
    adquirentes: t.adquirentes.map(doiParty),
  };
}

export function doiObject(transfers: TitleTransfer[]) {
  return { declaracoes: transfers.map(doiDeclaration) };
}

export function doiJson(transfers: TitleTransfer[]): string {
  return `${JSON.stringify(doiObject(transfers), null, 2)}\n`;
}

export function doiXml(transfers: TitleTransfer[]): string {
  return toXml(doiObject(transfers), {
    declaracoes: "declaracao",
    alienantes: "alienante",
    adquirentes: "adquirente",
  });
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
