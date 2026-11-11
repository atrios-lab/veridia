/**
 * Reads the papers the office already has (decision of 11/11/2026), so
 * the Livro Diário Auxiliar fills itself in:
 *
 * - the management system's "Relatório de Produtividade" (Notaris), of
 *   one day or of the month: every act with its quantity, emolumentos,
 *   the State's funds (FDJ, FRMP, FCRCPN, FPGE) and the ISS;
 * - a payment receipt (the bank's "Comprovante de pagamento", a DAM):
 *   the amount, the day it was paid and what it was.
 *
 * The text comes as the panel extracts it from the PDF (one line per row,
 * lib/fee-tables.ts pdfTableText). Nothing read is trusted blindly: it goes
 * to a screen to be checked and edited before it is booked.
 */

export interface ProductivityAct {
  /** "2200556"; empty for the report's rows with no code ("-"). */
  code: string;
  description: string;
  quantity: number;
  emolumentsCents: number;
  discountCents: number;
  fdjCents: number;
  frmpCents: number;
  fcrcpnCents: number;
  fpgeCents: number;
  costsDiscountCents: number;
  issCents: number;
  grossCents: number;
  netCents: number;
}

export interface ProductivityReading {
  /** "YYYY-MM-DD", from "De: 01/10/2026 até 31/10/2026". */
  start: string | null;
  end: string | null;
  acts: ProductivityAct[];
  /** "[C] Custeio (Tot. Desp.)" of the summary, when printed. */
  costsCents: number | null;
}

const MONEY = String.raw`\d{1,3}(?:\.\d{3})*,\d{2}`;
/** Quantity and the ten amounts of an act's row, at the end of a line. */
const ROW = new RegExp(
  String.raw`(?:^|\s)(\d+)\s+((?:${MONEY}\s+){9}${MONEY})\s*$`,
);

export function cents(value: string): number {
  return Math.round(
    Number(value.replace(/[R$\s.]/g, "").replace(",", ".")) * 100,
  );
}

const isoOf = (br: string) =>
  `${br.slice(6, 10)}-${br.slice(3, 5)}-${br.slice(0, 2)}`;

/** Lines of the report that are page furniture, not an act. */
const NOISE =
  /^(page \d+ of \d+|desc\.|ato qte\.|emol\.|relat[óo]rio de produtividade|\(registrado|de: \d{2}\/|file:\/\/)/i;

export function parseProductivity(text: string): ProductivityReading {
  const period = text.match(
    /De:\s*(\d{2}\/\d{2}\/\d{4})\s*at[ée]\s*(\d{2}\/\d{2}\/\d{4})/i,
  );
  const reading: ProductivityReading = {
    start: period?.[1] ? isoOf(period[1]) : null,
    end: period?.[2] ? isoOf(period[2]) : null,
    acts: [],
    costsCents: null,
  };
  const summary = text.match(
    new RegExp(
      String.raw`\n\s*\d+\s+R\$\s*${MONEY}\s+R\$\s*${MONEY}\s+R\$\s*(${MONEY})`,
    ),
  );
  if (summary?.[1]) reading.costsCents = cents(summary[1]);

  let current: { code: string; description: string[]; row?: string[] } | null =
    null;
  const close = () => {
    if (!current?.row) return;
    const [quantity, ...values] = current.row;
    const v = values.map(cents);
    reading.acts.push({
      code: current.code,
      description:
        current.description.join(" ").replace(/\s+/g, " ").trim() ||
        "Ato sem código no relatório",
      quantity: Number(quantity),
      emolumentsCents: v[0] ?? 0,
      discountCents: v[1] ?? 0,
      fdjCents: v[2] ?? 0,
      frmpCents: v[3] ?? 0,
      fcrcpnCents: v[4] ?? 0,
      fpgeCents: v[5] ?? 0,
      costsDiscountCents: v[6] ?? 0,
      issCents: v[7] ?? 0,
      grossCents: v[8] ?? 0,
      netCents: v[9] ?? 0,
    });
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || NOISE.test(line)) continue;
    if (/^TOTAL\b/.test(line)) break;
    const start = line.match(/^(\d{5,9})\s*-\s*(.*)$/);
    const noCode = line.match(/^-\s+(\d+\s+.*)$/);
    if (start || noCode) {
      close();
      current = { code: start?.[1] ?? "", description: [] };
    }
    if (!current) continue;
    const rest = start ? (start[2] ?? "") : noCode ? (noCode[1] ?? "") : line;
    const row = rest.match(ROW);
    if (row && !current.row) {
      const before = rest.slice(0, row.index).trim();
      if (before) current.description.push(before);
      current.row = [row[1] ?? "0", ...(row[2] ?? "").trim().split(/\s+/)];
    } else if (!row) {
      current.description.push(rest);
    }
  }
  close();
  return reading;
}

/* --------------------------------------------------------------- receipts */

export interface ReceiptReading {
  amountCents: number | null;
  /** "YYYY-MM-DD": the day the money left (débito), or the due day. */
  paidOn: string | null;
  description: string;
  /** A category of art. 191-A, § 1º, when the paper says it ("ISS"). */
  category: string | null;
}

/**
 * A payment receipt or a DAM: the amount, the day and what it was. The
 * bank's receipt prints its labels and values on separate lines, so the
 * label is looked for and the value taken from it or the lines next to it.
 */
export function parseReceipt(text: string): ReceiptReading {
  const flat = text.replace(/\s+/g, " ");
  const amount =
    flat.match(
      new RegExp(
        String.raw`Valor(?: total do documento| pago| do pagamento)?\s*:?\s*R?\$?\s*(${MONEY})`,
        "i",
      ),
    ) ??
    flat.match(
      new RegExp(
        String.raw`Valor Total do documento[^\d]{0,40}(${MONEY})`,
        "i",
      ),
    ) ??
    flat.match(new RegExp(String.raw`R\$\s*(${MONEY})`));
  const date =
    flat.match(/Data (?:de )?d[ée]bito\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i) ??
    flat.match(
      /Data(?:\/hora)? d[ae] (?:pagamento|opera[çcg][ãa]o)\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i,
    ) ??
    flat.match(/vencimento\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i);
  const isIss =
    /D\.?A\.?M\b|Documento de Arrecada[çcq][ãa]o Municipal/i.test(flat) &&
    /\bISS\b/.test(flat);
  const note = flat.match(/(NOTA\s*\d{3,})/i)?.[1];
  const payee = flat.match(
    /Conv[êe]nio\s*:?\s*([A-Z][A-Z .-]{3,60}?)(?:\s{2,}|\s+Valor|\s+-\s|$)/i,
  )?.[1];
  return {
    amountCents: amount?.[1] ? cents(amount[1]) : null,
    paidOn: date?.[1] ? isoOf(date[1]) : null,
    description: isIss
      ? `ISS recolhido à prefeitura${note ? ` (${note.replace(/\s+/, " ")})` : ""}`
      : payee
        ? `Pagamento: ${payee.trim().replace(/-+$/, "").trim()}`
        : "",
    category: isIss ? "iss" : null,
  };
}
