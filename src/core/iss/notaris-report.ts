/**
 * Reads the month's reports the office's management system prints
 * (Notaris: "Relatório de Produtividade" and "Valores Tributários no
 * Período") from their text, so the Declaração de ISS and the monthly
 * bulletin fill themselves in (decision of 11/11/2026). Everything read
 * stays editable: a report this does not recognise only leaves the fields
 * as they were.
 *
 * Productivity, TOTAL row: Qte, Emol., Desc. Emol., FDJ, FRMP, FCRCPN,
 * FPGE, Desc. Custas, ISSQN, Total Bruto, Total Líq. Its summary: Atos,
 * [A] Arrec. Bruta (Emolumentos), [B] Arrec. Líq. Emol., [C] Custeio,
 * [D] Repasses, [E] Arrec. Tot. Bruta (A + D + ISSQN), Arrec. Tot. Líq.
 *
 * Taxes ("Valores Tributários"), TOTAL row: Qte, Emol., Desc. Emol.,
 * Total Líq., ISSQN; the header names the rate ("ISSQN 5,00%").
 */
export interface ReportFigures {
  /** "2026-10", from "De: 01/10/2026 até 31/10/2026". */
  competence?: string;
  actsCount?: number;
  emolumentsCents?: number;
  /** ISS worked out act by act (acts without ISS count zero). */
  issCents?: number;
  rateBasisPoints?: number;
  /** By the bulletin's fund keys; FPGE is the RN fund the bulletin calls FUNAF. */
  funds?: { fdj: number; frmp: number; fcrcpn: number; funaf: number };
  /** [E]: everything that came in, funds and ISS included. */
  grossRevenueCents?: number;
  /** [C]: the office's costs. */
  expensesCents?: number;
  kind: "produtividade" | "tributos" | "desconhecido";
}

function cents(value: string): number {
  return Math.round(Number(value.replace(/\./g, "").replace(",", ".")) * 100);
}

/** The numbers right after "TOTAL", in order. */
function totalRow(text: string): { count: number; values: number[] } | null {
  const at = text.lastIndexOf("TOTAL ");
  if (at < 0) return null;
  const tail = text.slice(at + 6, at + 400);
  const count = tail.match(/^\s*(\d+)\s/);
  if (!count) return null;
  const rest = tail.slice(count[0].length);
  const values: number[] = [];
  for (const match of rest.matchAll(/(\d{1,3}(?:\.\d{3})*,\d{2})|(\S+)/g)) {
    if (!match[1]) break;
    values.push(cents(match[1]));
  }
  return { count: Number(count[1]), values };
}

export function parseNotarisReport(raw: string): ReportFigures {
  const text = raw.replace(/\s+/g, " ");
  const out: ReportFigures = { kind: "desconhecido" };
  const period = text.match(/De:\s*\d{2}\/(\d{2})\/(\d{4})\s*at[ée]/i);
  if (period) out.competence = `${period[2]}-${period[1]}`;

  const total = totalRow(text);
  if (/RELAT[ÓO]RIO DE PRODUTIVIDADE/i.test(text) && total) {
    const [emol, , fdj, frmp, fcrcpn, fpge, , iss] = total.values;
    if (total.values.length >= 8) {
      out.kind = "produtividade";
      out.actsCount = total.count;
      out.emolumentsCents = emol;
      out.funds = { fdj, frmp, fcrcpn, funaf: fpge };
      out.issCents = iss;
    }
    // The summary below the table: costs and the total intake.
    const summary = text.slice(text.indexOf("Atos Praticados"));
    const figures = [
      ...summary.matchAll(/R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g),
    ].map((m) => cents(m[1]));
    if (figures.length >= 5) {
      out.expensesCents = figures[2];
      out.grossRevenueCents = figures[4];
    }
    return out;
  }

  if (
    /Valores Tribut[áa]rios/i.test(text) &&
    total &&
    total.values.length >= 2
  ) {
    out.kind = "tributos";
    out.actsCount = total.count;
    out.emolumentsCents = total.values[0];
    out.issCents = total.values.at(-1);
    const rate = text.match(/ISSQN\s*(\d{1,2}),(\d{2})\s*%/i);
    if (rate) out.rateBasisPoints = Number(rate[1]) * 100 + Number(rate[2]);
  }
  return out;
}

/** Two reports of the same month, read together: the first value found wins. */
export function mergeReports(reports: ReportFigures[]): ReportFigures {
  let out: ReportFigures = { kind: "desconhecido" };
  for (const report of reports) {
    const found = Object.fromEntries(
      Object.entries(report).filter(([, value]) => value !== undefined),
    ) as Partial<ReportFigures>;
    out = {
      ...found,
      ...Object.fromEntries(
        Object.entries(out).filter(([, value]) => value !== undefined),
      ),
      kind: out.kind === "desconhecido" ? report.kind : out.kind,
    };
  }
  return out;
}
