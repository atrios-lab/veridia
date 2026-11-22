import "server-only";
import JSZip from "jszip";
import { z } from "zod";
import {
  ADJUSTABLE_COLUMNS,
  type AdjustableColumn,
  type Adjustment,
  type AdjustResult,
  applyAdjustments,
  checkTable,
  type FeeTableData,
  parseCents,
  parseFactor,
  rowsOf,
} from "@/core/fees/custas.ts";
import { parseFeeTable } from "@/core/fees/custas-parse.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import type { Database } from "@/db/index.ts";
import { recordAuditWith } from "./audit.ts";
import { pdfLines, renderFeeTablePdf } from "./custas-pdf.ts";
import { currentFeeTableWith, FEE_TABLE_CATEGORY } from "./fee-tables.ts";
import { docxText } from "./titularidade-reading.ts";
import {
  createDocument,
  getDocument,
  makeCurrentFeeTableWith,
  type TransparencyDocumentRow,
} from "./transparency.ts";
import { readStoredFile, storeAttachments } from "./uploads.ts";

export class FeeTableError extends Error {}

/** Read tables by document and file: a 100-page PDF is read once. */
const baseCache = new Map<string, { data: FeeTableData; warnings: string[] }>();

export interface FeeTableBase {
  document: TransparencyDocumentRow;
  data: FeeTableData;
  warnings: string[];
}

/**
 * The table the adjustment starts from (decision of 22/11/2026): the one
 * in force, or another fee table the office picks, read from its PDF in
 * the office's standard. Fails, in words, when the PDF is not in it.
 */
export async function feeTableBaseWith(
  database: Database,
  tenantSlug: string,
  documentId?: string,
): Promise<FeeTableBase> {
  const document = documentId
    ? await getDocument(tenantSlug, documentId)
    : (await currentFeeTableWith(database, tenantSlug))?.document;
  if (!document || document.category !== FEE_TABLE_CATEGORY) {
    throw new FeeTableError(
      "Não há tabela de emolumentos publicada em Transparência para servir de base.",
    );
  }
  const key = `${document.id}:${document.filePath}`;
  let read = baseCache.get(key);
  if (!read) {
    const bytes = new Uint8Array(await readStoredFile(document.filePath));
    const parsed = parseFeeTable(await pdfLines(bytes));
    if (rowsOf(parsed.data).length < 10) {
      throw new FeeTableError(
        `"${document.title}" não está no padrão da tabela de custas (capa, sumário e tabelas com código e valores): não deu para ler as linhas.`,
      );
    }
    read = parsed;
    baseCache.set(key, read);
  }
  return { document, data: read.data, warnings: read.warnings };
}

// ------------------------------------------------------------ attachments

/** Cells of an .xlsx, sheet by sheet, one row per line, ";" between cells. */
async function xlsxText(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const shared: string[] = [];
  const sst = await zip.file("xl/sharedStrings.xml")?.async("string");
  if (sst) {
    for (const si of sst.match(/<si>[\s\S]*?<\/si>/g) ?? []) {
      shared.push(
        (si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? [])
          .map((t) => t.replace(/<[^>]+>/g, ""))
          .join(""),
      );
    }
  }
  const sheets = Object.keys(zip.files)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort();
  const out: string[] = [];
  for (const name of sheets) {
    const xml = (await zip.file(name)?.async("string")) ?? "";
    for (const row of xml.match(/<row[\s\S]*?<\/row>/g) ?? []) {
      const cells = (row.match(/<c [^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) ?? []).map(
        (c) => {
          const v = /<v>([\s\S]*?)<\/v>/.exec(c)?.[1] ?? "";
          const inline = /<t[^>]*>([\s\S]*?)<\/t>/.exec(c)?.[1];
          if (/t="s"/.test(c)) return shared[Number(v)] ?? "";
          return inline ?? v;
        },
      );
      out.push(cells.join(";"));
    }
  }
  return out.join("\n");
}

/** An attachment as the assistant reads it: PDF as is, the rest as text. */
export async function attachmentForReading(
  file: File,
): Promise<
  | { kind: "pdf"; name: string; bytes: Uint8Array }
  | { kind: "text"; name: string; text: string }
> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const name = file.name || "anexo";
  const lower = name.toLowerCase();
  if (file.type === "application/pdf" || lower.endsWith(".pdf")) {
    return { kind: "pdf", name, bytes };
  }
  if (lower.endsWith(".docx"))
    return { kind: "text", name, text: await docxText(bytes) };
  if (lower.endsWith(".xlsx"))
    return { kind: "text", name, text: await xlsxText(bytes) };
  if (/\.(csv|txt)$/.test(lower) || file.type.startsWith("text/")) {
    return { kind: "text", name, text: new TextDecoder().decode(bytes) };
  }
  throw new FeeTableError(
    `"${name}": anexe PDF, Word (.docx), planilha (.xlsx ou .csv) ou texto.`,
  );
}

/**
 * A spreadsheet that is plainly "código; valor" read without the
 * assistant: each line with a code of the table and one amount. Null when
 * the text is not that (fewer than three such lines).
 */
export function codeValuesFromText(
  text: string,
  codes: Set<string>,
): { code: string; cents: number }[] | null {
  const out: { code: string; cents: number }[] = [];
  for (const line of text.split(/\r?\n/)) {
    // ";" or tab between cells; a comma only when neither is there (the
    // comma is also the decimal mark of "0,73").
    const separator = line.includes(";")
      ? ";"
      : line.includes("\t")
        ? "\t"
        : ",";
    const cells = line.split(separator).map((c) => c.trim());
    const code = cells.find(
      (c) => codes.has(c.replace(/\D/g, "")) && /^\d[\d.\-/]*$/.test(c),
    );
    if (!code) continue;
    const amounts = cells
      .filter((c) => c !== code)
      .map((c) => parseCents(c))
      .filter((v): v is number => v !== null);
    if (amounts.length !== 1) continue;
    out.push({ code: code.replace(/\D/g, ""), cents: amounts[0] as number });
  }
  return out.length >= 3 ? out : null;
}

// ------------------------------------------------------------ the plan

const columnSchema = z.enum(ADJUSTABLE_COLUMNS);

/** What the screen sends back: the adjustments and the texts, checked. */
export const feeTablePlanSchema = z.object({
  base: z.string().uuid(),
  adjustments: z
    .array(
      z.discriminatedUnion("mode", [
        z.object({
          column: columnSchema,
          mode: z.literal("indice"),
          factorMicro: z.number().int().min(100_000).max(10_000_000),
        }),
        z.object({
          column: columnSchema,
          mode: z.literal("valores"),
          values: z
            .array(
              z.object({
                code: z.string().regex(/^\d{3,12}$/),
                cents: z.number().int().min(0).max(1_000_000_000),
              }),
            )
            .min(1)
            .max(6000),
        }),
      ]),
    )
    .min(1)
    .max(6),
  title: z.string().trim().min(5).max(200),
  validity: z.string().trim().max(300),
  presentation: z.string().trim().max(6000),
  documentTitle: z.string().trim().min(3).max(200),
  yearLabel: z.string().trim().min(1).max(40),
  law: z.string().trim().min(3).max(500),
});
export type FeeTablePlan = z.infer<typeof feeTablePlanSchema>;

/** The assistant's reading as adjustments, keeping what is well formed. */
export function adjustmentsFromReading(
  adjustments: {
    column: string;
    mode: "indice" | "valores";
    factor?: string;
    values?: { code: string; value: string }[];
  }[],
  chosen: AdjustableColumn | "",
): { adjustments: Adjustment[]; dropped: string[] } {
  const out: Adjustment[] = [];
  const dropped: string[] = [];
  for (const a of adjustments) {
    const column = (chosen ||
      a.column.replace(/[^a-z]/g, "")) as AdjustableColumn;
    if (!(ADJUSTABLE_COLUMNS as readonly string[]).includes(column)) {
      dropped.push(`coluna "${a.column}" não é ajustável`);
      continue;
    }
    if (a.mode === "indice") {
      const factorMicro = parseFactor(a.factor ?? "");
      if (factorMicro === null) dropped.push(`índice "${a.factor}" ilegível`);
      else out.push({ column, mode: "indice", factorMicro });
      continue;
    }
    const values: { code: string; cents: number }[] = [];
    for (const v of a.values ?? []) {
      const cents = parseCents(v.value);
      if (cents === null)
        dropped.push(`valor "${v.value}" do código ${v.code}`);
      else values.push({ code: v.code.replace(/\D/g, ""), cents });
    }
    if (values.length) out.push({ column, mode: "valores", values });
  }
  return { adjustments: out, dropped };
}

/** The new table: the base with the adjustments and the new texts. */
export function adjustedTable(
  base: FeeTableData,
  plan: Pick<
    FeeTablePlan,
    "adjustments" | "title" | "validity" | "presentation"
  >,
): AdjustResult {
  const result = applyAdjustments(base, plan.adjustments as Adjustment[]);
  const presentation = plan.presentation
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return {
    ...result,
    data: {
      blocks: result.data.blocks,
      meta: {
        ...result.data.meta,
        title: plan.title,
        validity: plan.validity || result.data.meta.validity,
        year: /\b(\d{4})\b/.exec(plan.title)?.[1] ?? result.data.meta.year,
        presentation: presentation.length
          ? presentation
          : result.data.meta.presentation,
      },
    },
  };
}

export async function feeTablePdfWith(
  database: Database,
  tenantSlug: string,
  plan: FeeTablePlan,
): Promise<{ bytes: Buffer; result: AdjustResult }> {
  const base = await feeTableBaseWith(database, tenantSlug, plan.base);
  const result = adjustedTable(base.data, plan);
  const { errors } = checkTable(result.data);
  const changedCodes = new Set(result.changes.map((c) => c.code));
  // A row this adjustment touched must add up; an error the base already
  // had is the source's, reported on the screen, not a reason to stop.
  const own = errors.filter((e) => changedCodes.has(e.code));
  if (own.length > 0) {
    throw new FeeTableError(
      `Conta que não fecha depois do ajuste: ${own.map((e) => `${e.code} (${e.problem})`).join("; ")}.`,
    );
  }
  return { bytes: await renderFeeTablePdf(result.data), result };
}

/**
 * Publishes the new table as the one in force (decision of 22/11/2026:
 * "já publica com o nome, a lei que alterou"): a transparency document in
 * the fee table category, at the top, published, with the law in the audit.
 * The previous table stays in Transparência, below it.
 */
export async function publishFeeTableWith(
  database: Database,
  tenant: Tenant,
  plan: FeeTablePlan,
  actorId: string,
): Promise<{ id: string; changes: number }> {
  const { bytes, result } = await feeTablePdfWith(database, tenant.slug, plan);
  if (result.changes.length === 0) {
    throw new FeeTableError("O ajuste não muda nenhum valor da tabela base.");
  }
  const fileName = `${plan.documentTitle.replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 120) || "tabela-de-custas"}.pdf`;
  const [stored] = await storeAttachments(
    [new File([new Uint8Array(bytes)], fileName, { type: "application/pdf" })],
    { tenantSlug: tenant.slug, kind: "documento", name: plan.documentTitle },
  );
  if (!stored) throw new FeeTableError("Não foi possível guardar o PDF.");
  const created = await createDocument(
    tenant.slug,
    {
      category: FEE_TABLE_CATEGORY,
      title: plan.documentTitle,
      yearLabel: plan.yearLabel,
    },
    stored,
    actorId,
  );
  await makeCurrentFeeTableWith(
    database,
    tenant.slug,
    created.id,
    FEE_TABLE_CATEGORY,
    actorId,
  );
  await recordAuditWith(database, {
    tenantSlug: tenant.slug,
    actorId,
    action: "transparency.fee-table.generated",
    targetType: "transparency-document",
    targetId: created.id,
    reason: `${plan.law} · ${result.changes.length} linhas alteradas`.slice(
      0,
      1000,
    ),
  });
  return { id: created.id, changes: result.changes.length };
}
