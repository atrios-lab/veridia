import {
  AUX_ROLE_LABELS,
  type AuxData,
  type AuxParty,
  type AuxRole,
  EMPTY_AUX,
} from "./auxiliary.ts";
import { isoDate, matriculaNumber } from "./property.ts";

/**
 * A registro of the Livro 3 read from its text, when the assistente
 * virtual is not there to read it: the registros follow the model the
 * registradores use (TÍTULO, EMITENTE, CREDOR, VALOR, VENCIMENTO,
 * GARANTIAS, PROTOCOLO), so each label opens a field. What is not found
 * stays empty for the clerk to fill; nothing is guessed but the natureza,
 * from the words of the título.
 */

export interface AuxReading {
  number: number | null;
  openedOn: string | null;
  auxKind: string;
  linkedNumbers: string;
  aux: AuxData;
  notes: string[];
}

const fold = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

const LABELS: [RegExp, string][] = [
  [/^T[IÍ]TULO/, "title"],
  [/^EMITENTES?\b/, "emitente"],
  [/^DEVEDOR(A|ES)?\b/, "devedor"],
  [/^CREDOR(A|ES)?\b/, "credor"],
  [/^AVALISTAS?\b/, "avalista"],
  [/^INTERVENIENTES?\b/, "interveniente"],
  [/^FIEL DEPOSIT[AÁ]RIO/, "depositario"],
  [/^C[OÔ]NJUGES?\b|^NUBENTES?\b|^CONTRATANTES?\b/, "conjuge"],
  [/^EMISSORA\b/, "emissora"],
  [/^AGENTE FIDUCI[AÁ]RIO/, "agente"],
  [/^VALOR/, "value"],
  [/^VENCIMENTO/, "dueOn"],
  [/^PRA[CÇ]A DE PAGAMENTO/, "paymentPlace"],
  [/^FORMA DE PAGAMENTO|^ENCARGOS|^JUROS/, "terms"],
  [/^GARANTIAS?\b|^BENS? EMPENHADOS?/, "guarantees"],
  [/^LOCAL(IZA[CÇ][AÃ]O)? DOS BENS/, "goodsPlace"],
  [/^REGIME DE BENS/, "regime"],
  [/^CASAMENTO|^DATA DO CASAMENTO/, "weddingOn"],
  [/^DOMIC[IÍ]LIO/, "domicile"],
  [/^ESCRITURA|^FORMA DO T[IÍ]TULO/, "deed"],
  [/^PROTOCOLO/, "protocol"],
  [/^ANOTA[CÇ](AO|OES|ÃO|ÕES)|^REMISS/, "annotation"],
];

const KINDS: [RegExp, string][] = [
  [/CREDITO INDUSTRIAL/, "Cédula de crédito industrial"],
  [
    /PIGNORATICIA|PENHOR RURAL|PENHOR AGRICOLA|PENHOR PECUARIO/,
    "Contrato de penhor rural",
  ],
  [
    /PENHOR INDUSTRIAL|MAQUINAS E APARELHOS/,
    "Penhor de máquinas e aparelhos da indústria",
  ],
  [/ANTENUPCIA|PACTO/, "Convenção antenupcial (pacto antenupcial)"],
  [
    /CONVENCAO DE CONDOMINIO|CONDOMINIO EDILICIO|MULTIPROPRIEDADE/,
    "Convenção de condomínio (edilício, geral voluntário ou multipropriedade)",
  ],
  [/DEBENTURE/, "Emissão de debêntures"],
  [/BEM DE FAMILIA/, "Instituição de bem de família (escritura)"],
  [
    /INTEIRO TEOR/,
    "Título registrado no inteiro teor, a pedido do interessado",
  ],
];

/** "BANCO EXEMPLO S.A., CNPJ nº 11.222.333/0001-81, com sede…" → parties. */
function partiesOf(text: string, role: AuxRole): AuxParty[] {
  return text
    .split(/;\s*|\s+e,\s+|\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const doc =
        /\d{2,3}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{3}\.?\d{3}\.?\d{3}-?\d{2}/.exec(
          chunk,
        )?.[0] ?? "";
      const name = chunk
        .split(/,|\bCPF\b|\bCNPJ\b|\bRG\b|\bcom sede\b|\binscrit/i)[0]
        ?.replace(/\s+/g, " ")
        .replace(/[;:]+$/, "")
        // "S.A." keeps its last dot; "FICTÍCIA." does not.
        .replace(/([^.\s]{2})\.$/, "$1")
        .trim();
      return { name: name ?? "", document: doc.replace(/\D/g, ""), role };
    })
    .filter((p) => p.name.length > 2 && !/^\.+$/.test(p.name));
}

const firstDate = (text: string): string | null => {
  const m = /(\d{1,2})[/.](\d{1,2})[/.](\d{4})/.exec(text);
  return m ? isoDate(`${m[1]}/${m[2]}/${m[3]}`) : null;
};

const cents = (text: string): number | null => {
  const m = /R\$\s*([\d.]+,\d{2})/.exec(text);
  if (!m?.[1]) return null;
  return Math.round(Number(m[1].replace(/\./g, "").replace(",", ".")) * 100);
};

/** The fields of a Livro 3 registro, from its text. */
export function readAuxText(text: string): AuxReading {
  const aux: AuxData = { ...EMPTY_AUX, parties: [], annotations: [] };
  const notes: string[] = [];
  // Each "LABEL: value" up to the next label (values span lines).
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: { key: string; value: string }[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    const head =
      colon > 0 && colon < 40 ? fold(line.slice(0, colon)).trim() : "";
    const key = head
      ? LABELS.find(([rule]) => rule.test(head))?.[1]
      : undefined;
    if (key) blocks.push({ key, value: line.slice(colon + 1).trim() });
    else if (blocks.length) {
      const last = blocks[blocks.length - 1] as { key: string; value: string };
      last.value = `${last.value}\n${line}`;
    }
  }
  for (const { key, value } of blocks) {
    const v = value.trim();
    if (key in AUX_ROLE_LABELS) {
      aux.parties.push(...partiesOf(v, key as AuxRole));
      continue;
    }
    switch (key) {
      case "title": {
        aux.title =
          v
            .split(/,\s*emitid|,\s*lavrad/i)[0]
            ?.replace(/\.$/, "")
            .trim() ?? v;
        aux.issuedOn = /emitid|lavrad/i.test(v) ? firstDate(v) : null;
        break;
      }
      case "value":
        aux.valueCents = cents(v);
        break;
      case "dueOn":
        aux.dueOn = firstDate(v);
        break;
      case "weddingOn":
        aux.weddingOn = firstDate(v);
        break;
      case "annotation": {
        aux.annotations.push({
          id: `lida-${aux.annotations.length + 1}`,
          on: firstDate(v),
          // The date goes in its own field, not repeated in the text.
          text: v
            .replace(/^(em\s+)?\d{1,2}[/.]\d{1,2}[/.]\d{4}[\s:,.-]*/i, "")
            .slice(0, 5000),
          at: "",
          by: "",
          deletedAt: null,
          history: [],
        });
        break;
      }
      case "protocol": {
        aux.protocolNumber =
          /n\.?\s*[ºo°]?\s*([\d.]+)/i.exec(v)?.[1]?.replace(/\./g, "") ?? "";
        aux.protocolOn = firstDate(v);
        break;
      }
      case "paymentPlace":
      case "terms":
      case "guarantees":
      case "goodsPlace":
      case "regime":
      case "domicile":
      case "deed":
        aux[key] = v
          .replace(/\s+$/, "")
          .slice(0, key === "guarantees" ? 5000 : 2000);
        break;
    }
  }
  const all = fold(`${aux.title}\n${text.slice(0, 2000)}`);
  const auxKind = KINDS.find(([rule]) => rule.test(all))?.[1] ?? "";
  if (!auxKind)
    notes.push(
      "Não deu para saber a natureza do registro: escolha na conferência.",
    );
  if (/HIPOTECA CEDULAR|RURAL HIPOTECARIA/.test(all)) {
    notes.push(
      "A cédula tem hipoteca: o registro da hipoteca vai na matrícula do imóvel (Livro 2), com remissão a este registro.",
    );
  }
  const number = matriculaNumber(
    /REGISTRO\s+(?:AUXILIAR\s+)?N\.?\s*[ºO°]?\s*([\d.]+)/.exec(
      fold(text),
    )?.[1] ?? "",
  );
  const linked = [
    ...new Set(
      [
        ...fold(text).matchAll(
          /MATRICULA\s+(?:N\.?\s*[ºO°]?\s*|NUMERO\s+)?([\d.]{1,9})/g,
        ),
      ]
        .map((m) => m[1]?.replace(/\.$/, "") ?? "")
        .filter((n) => /\d/.test(n)),
    ),
  ];
  return {
    number,
    openedOn: aux.protocolOn,
    auxKind,
    linkedNumbers: linked.join("; "),
    aux,
    notes,
  };
}

/**
 * The document as Markdown, to keep in place of the file (decision of
 * 26/11/2026): the labels of the registro in bold, the paragraphs kept.
 */
export function toMarkdown(text: string, title: string): string {
  const body = text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => {
      const m =
        /^([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ /()º°.-]{2,40}):\s*(.*)$/.exec(
          line.trim(),
        );
      return m ? `**${m[1]}:** ${m[2]}` : line.trim();
    })
    .join("\n")
    .trim();
  return `# ${title.replace(/[#\n]/g, " ").trim()}\n\n${body}\n`;
}
