"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { INTERIM_PERIODS, type InterimPeriod } from "@/core/daily-book/book.ts";
import { LONG_TEXT_MAX } from "@/core/text-limits.ts";
import { parseMoneyBRL } from "@/core/transparency/bulletin.ts";
import { db } from "@/db/index.ts";
import { justify } from "@/lib/audit-reason.ts";
import { DailyBookError } from "@/lib/daily-book.ts";
import {
  bookFiguresWith,
  removeExcessWith,
  saveExcessWith,
} from "@/lib/daily-book-excess.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export type ExcessFormState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

const HOME = "/admin/utilitarios/livro-diario/excedente";
const NO_PERMISSION = "Você não tem permissão para o Livro Diário Auxiliar.";

async function access() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "daily-book.manage", session.user.permissions)
  ) {
    return undefined;
  }
  return { session, tenant: await getTenant() };
}

const field = (formData: FormData, name: string, max = 300) =>
  String(formData.get(name) ?? "")
    .trim()
    .slice(0, max);
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

function fail(error: unknown): ExcessFormState {
  if (error instanceof DailyBookError) {
    return { status: "error", message: error.message };
  }
  console.error("daily-book.excess", error);
  return {
    status: "error",
    message: "Não foi possível salvar agora. Tente de novo em instantes.",
  };
}

/** Saves a calculation (new, or `id` edited) and opens it. */
export async function saveExcess(
  _previous: ExcessFormState,
  formData: FormData,
): Promise<ExcessFormState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const typed = field(formData, "periodo", 20);
  const period: InterimPeriod = (INTERIM_PERIODS as readonly string[]).includes(
    typed,
  )
    ? (typed as InterimPeriod)
    : "trimestral";
  const start = field(formData, "inicio", 10);
  const end = field(formData, "fim", 10);
  if (!isDate(start) || !isDate(end) || end < start) {
    return { status: "error", message: "Confira o período." };
  }
  const subsidy = parseMoneyBRL(field(formData, "subsidio", 20));
  const revenue = parseMoneyBRL(field(formData, "receitas", 20));
  const expenses = parseMoneyBRL(field(formData, "despesas", 20));
  if (subsidy === null || subsidy === 0) {
    return {
      status: "error",
      message: "Informe o subsídio mensal de ministro do STF (ex.: 40.000,00).",
    };
  }
  if (revenue === null || expenses === null) {
    return {
      status: "error",
      message: "Confira as receitas e as despesas (ex.: 1.234,56).",
    };
  }
  const id = field(formData, "id", 40) || undefined;
  let savedId: string;
  try {
    const saved = await saveExcessWith(
      db,
      ok.tenant.slug,
      {
        period,
        start,
        end,
        subsidyCents: subsidy,
        revenueCents: revenue,
        expensesCents: expenses,
        notes: field(formData, "observacoes", LONG_TEXT_MAX),
      },
      ok.session.user.id,
      id,
    );
    savedId = saved.id;
  } catch (error) {
    return fail(error);
  }
  revalidatePath(HOME);
  redirect(`${HOME}/${savedId}?salvo=${id ? "editado" : "novo"}`);
}

/** Removed with a reason; it stays stored. */
export async function removeExcess(
  _previous: ExcessFormState,
  formData: FormData,
): Promise<ExcessFormState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const problem = justify(formData);
  if (problem) return { status: "error", message: problem };
  try {
    await removeExcessWith(
      db,
      ok.tenant.slug,
      field(formData, "id", 40),
      String(formData.get("justificativa") ?? "").trim(),
      ok.session.user.id,
    );
  } catch (error) {
    return fail(error);
  }
  revalidatePath(HOME);
  redirect(`${HOME}?feito=excluido`);
}

/** The period's receipts and expenses from the book, to fill the form. */
export async function readBookFigures(
  formData: FormData,
): Promise<
  | { ok: true; revenueCents: number; expensesCents: number }
  | { ok: false; message: string }
> {
  const ok = await access();
  if (!ok) return { ok: false, message: NO_PERMISSION };
  const start = field(formData, "inicio", 10);
  const end = field(formData, "fim", 10);
  if (!isDate(start) || !isDate(end) || end < start) {
    return { ok: false, message: "Confira o período." };
  }
  try {
    return {
      ok: true,
      ...(await bookFiguresWith(db, ok.tenant.slug, { start, end })),
    };
  } catch {
    return { ok: false, message: "Não foi possível ler o livro agora." };
  }
}
