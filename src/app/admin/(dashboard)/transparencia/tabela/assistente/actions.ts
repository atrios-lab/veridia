"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { can } from "@/core/auth/roles.ts";
import {
  ADJUSTABLE_COLUMNS,
  type AdjustableColumn,
  type Adjustment,
  brl,
  COLUMN_LABELS,
  changeTotals,
  checkTable,
  FEE_COLUMNS,
  type FeeColumn,
  formatFactor,
  rowsOf,
} from "@/core/fees/custas.ts";
import { db } from "@/db/index.ts";
import { AiError, aiBlockedWith, readFeeAdjustment } from "@/lib/ai.ts";
import {
  adjustedTable,
  adjustmentsFromReading,
  attachmentForReading,
  codeValuesFromText,
  FeeTableError,
  feeTableBaseWith,
  feeTablePlanSchema,
  publishFeeTableWith,
} from "@/lib/custas.ts";
import { readNewFeeTable } from "@/lib/fee-tables.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

async function authorize() {
  const session = await getSession();
  if (
    !session ||
    !can(
      session.user.role ?? "",
      "transparency.manage",
      session.user.permissions,
    )
  ) {
    return null;
  }
  return session;
}

const NO_PERMISSION = "Sem permissão para alterar a Transparência.";
const GENERIC = "Não foi possível agora. Tente de novo em instantes.";

export type ReadState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "read";
      source: "assistente" | "planilha" | "indice";
      law: { name: string; number: string; date: string; effective: string };
      summary: string;
      doubts: string;
      adjustments: Adjustment[];
      dropped: string[];
    };

/**
 * Step 1 (decision of 22/11/2026): what changes. A spreadsheet that is
 * plainly "código; valor", with the column chosen, is read here, without
 * the assistant; a law, a PDF table or an index goes to the assistant;
 * with no file, the index typed by the clerk is the adjustment.
 */
export async function readAdjustmentAction(
  _previous: ReadState,
  formData: FormData,
): Promise<ReadState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const tenant = await getTenant();
  const base = String(formData.get("base") ?? "");
  const column = String(formData.get("coluna") ?? "") as AdjustableColumn | "";
  if (column && !(ADJUSTABLE_COLUMNS as readonly string[]).includes(column)) {
    return { status: "error", message: "Coluna inválida." };
  }
  const note = String(formData.get("nota") ?? "").slice(0, 2000);
  const index = String(formData.get("indice") ?? "").trim();
  const files = formData
    .getAll("anexos")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, 5);
  try {
    const table = await feeTableBaseWith(db, tenant.slug, base || undefined);
    const emptyLaw = { name: "", number: "", date: "", effective: "" };

    if (files.length === 0) {
      if (!column || !index) {
        return {
          status: "error",
          message:
            "Anexe a lei, a tabela ou a planilha do que mudou, ou escolha a coluna e informe o índice.",
        };
      }
      const read = adjustmentsFromReading(
        [{ column, mode: "indice", factor: index }],
        column,
      );
      if (read.adjustments.length === 0) {
        return {
          status: "error",
          message: `Índice "${index}" ilegível: use, por exemplo, 1,0521 ou 5,21%.`,
        };
      }
      return {
        status: "read",
        source: "indice",
        law: emptyLaw,
        summary: `${COLUMN_LABELS[column]} reajustado pelo índice ${index}.`,
        doubts: "",
        adjustments: read.adjustments,
        dropped: [],
      };
    }

    const readable = [];
    for (const file of files) readable.push(await attachmentForReading(file));

    // A clean "código; valor" spreadsheet, with the column chosen: no
    // assistant needed, nothing to interpret.
    if (column && readable.every((f) => f.kind === "text")) {
      const codes = new Set(rowsOf(table.data).map((r) => r.code));
      const values = readable.flatMap((f) =>
        f.kind === "text" ? (codeValuesFromText(f.text, codes) ?? []) : [],
      );
      if (values.length >= 3) {
        return {
          status: "read",
          source: "planilha",
          law: emptyLaw,
          summary: `${values.length} valores de ${COLUMN_LABELS[column]} lidos da planilha, por código.`,
          doubts: "",
          adjustments: [{ column, mode: "valores", values }],
          dropped: [],
        };
      }
    }

    const blocked = await aiBlockedWith(db, tenant.slug);
    if (blocked) {
      return {
        status: "error",
        message: `${blocked} Sem o assistente virtual, use uma planilha "código; valor" (com a coluna escolhida) ou informe o índice.`,
      };
    }
    const sample = rowsOf(table.data)
      .slice(0, 12)
      .map((r) => ({
        code: r.code,
        description: r.description.slice(0, 80),
        values: FEE_COLUMNS.map((c) => brl(r.cents[c])).join(", "),
      }));
    const reading = await readFeeAdjustment({
      files: readable,
      note,
      column,
      sample,
    });
    const read = adjustmentsFromReading(reading.adjustments, column);
    if (read.adjustments.length === 0) {
      return {
        status: "error",
        message: `O assistente virtual não achou no documento o que muda na tabela.${reading.doubts ? ` ${reading.doubts}` : ""} Confira o anexo ou informe o índice.`,
      };
    }
    return {
      status: "read",
      source: "assistente",
      law: reading.law,
      summary: reading.summary,
      doubts: reading.doubts,
      adjustments: read.adjustments,
      dropped: read.dropped,
    };
  } catch (error) {
    if (error instanceof FeeTableError || error instanceof AiError) {
      return { status: "error", message: error.message };
    }
    console.error("custas.read", error);
    return { status: "error", message: GENERIC };
  }
}

export interface PreviewRow {
  code: string;
  description: string;
  /** Only the columns that changed, before and after. */
  cells: { column: string; before: string; after: string }[];
}

export type PreviewState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      rowsTotal: number;
      changed: number;
      shown: PreviewRow[];
      totals: { column: string; rows: number; delta: string }[];
      notFound: string[];
      ambiguous: string[];
      adjustmentLabels: string[];
      baseErrors: string[];
      issExceptions: number;
    };

/** Step 2: every row that changes, before and after, and the checks. */
export async function previewAction(
  _previous: PreviewState,
  formData: FormData,
): Promise<PreviewState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const tenant = await getTenant();
  let plan: ReturnType<typeof feeTablePlanSchema.parse>;
  try {
    plan = feeTablePlanSchema.parse(
      JSON.parse(String(formData.get("plano") ?? "{}")),
    );
  } catch {
    return { status: "error", message: "Preencha os campos da nova tabela." };
  }
  try {
    const base = await feeTableBaseWith(db, tenant.slug, plan.base);
    const result = adjustedTable(base.data, plan);
    const check = checkTable(base.data);
    const totals = changeTotals(result.changes);
    return {
      status: "ok",
      rowsTotal: rowsOf(base.data).length,
      changed: result.changes.length,
      shown: result.changes.slice(0, 600).map((ch) => ({
        code: ch.code,
        description: ch.description.slice(0, 120),
        cells: FEE_COLUMNS.filter((c) => ch.before[c] !== ch.after[c]).map(
          (c) => ({
            column: COLUMN_LABELS[c],
            before: brl(ch.before[c]),
            after: brl(ch.after[c]),
          }),
        ),
      })),
      totals: (Object.keys(totals) as FeeColumn[])
        .filter((c) => totals[c].rows > 0)
        .map((c) => ({
          column: COLUMN_LABELS[c],
          rows: totals[c].rows,
          delta: `${totals[c].deltaCents < 0 ? "-" : "+"}${brl(Math.abs(totals[c].deltaCents))}`,
        })),
      notFound: result.notFound,
      ambiguous: result.ambiguous,
      adjustmentLabels: plan.adjustments.map((a) =>
        a.mode === "indice"
          ? `${COLUMN_LABELS[a.column]}: índice ${formatFactor(a.factorMicro)}`
          : `${COLUMN_LABELS[a.column]}: ${a.values.length} valores por código`,
      ),
      baseErrors: check.errors.map((e) => `${e.code}: ${e.problem}`),
      issExceptions: check.issExceptions.length,
    };
  } catch (error) {
    if (error instanceof FeeTableError)
      return { status: "error", message: error.message };
    console.error("custas.preview", error);
    return { status: "error", message: GENERIC };
  }
}

export type PublishState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; id: string; changes: number };

/** Step 3: published as the table in force, with the law in the audit. */
export async function publishAction(
  _previous: PublishState,
  formData: FormData,
): Promise<PublishState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };
  if (formData.get("conferido") !== "sim") {
    return {
      status: "error",
      message: "Marque que conferiu os valores alterados antes de publicar.",
    };
  }
  const tenant = await getTenant();
  let plan: ReturnType<typeof feeTablePlanSchema.parse>;
  try {
    plan = feeTablePlanSchema.parse(
      JSON.parse(String(formData.get("plano") ?? "{}")),
    );
  } catch {
    return { status: "error", message: "Preencha os campos da nova tabela." };
  }
  try {
    const done = await publishFeeTableWith(db, tenant, plan, session.user.id);
    // Its prenotações are read now, as for a table sent by hand.
    after(() => readNewFeeTable(tenant, done.id));
    revalidatePath("/admin/transparencia");
    revalidatePath("/transparencia");
    return { status: "success", ...done };
  } catch (error) {
    if (error instanceof FeeTableError)
      return { status: "error", message: error.message };
    console.error("custas.publish", error);
    return { status: "error", message: GENERIC };
  }
}
