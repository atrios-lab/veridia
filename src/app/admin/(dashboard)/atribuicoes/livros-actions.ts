"use server";

import { revalidatePath } from "next/cache";
import { can, type Permission } from "@/core/auth/roles.ts";
import {
  BookEntryError,
  bookOf,
  booksOf,
  detectBook,
  IMPORT_MODES,
  type ImportMode,
  readBookRows,
  readEntry,
  rowsOfJson,
} from "@/core/books/catalog.ts";
import { db } from "@/db/index.ts";
import { askApproval } from "@/lib/approval.ts";
import {
  createBookEntryWith,
  importBookEntriesWith,
  setBookEntryDeletedWith,
  updateBookEntryWith,
} from "@/lib/attribution-books.ts";
import { justify } from "@/lib/audit-reason.ts";
import { officeToday } from "@/lib/ri-protocols.ts";
import { SheetFileError, sheetRows } from "@/lib/ri-sheet.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export type BookState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

async function access(permission: Permission, formData: FormData) {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", permission, session.user.permissions)
  ) {
    return null;
  }
  const book = bookOf(
    String(formData.get("atribuicao") ?? ""),
    String(formData.get("livro") ?? ""),
  );
  if (!book) return null;
  return {
    session,
    book,
    tenant: await getTenant(),
    actor: { id: session.user.id },
  };
}

const DENIED: BookState = {
  status: "error",
  message: "Você não tem permissão para alterar este livro.",
};

function failure(error: unknown): BookState {
  if (error instanceof BookEntryError || error instanceof SheetFileError) {
    return { status: "error", message: error.message };
  }
  console.error("[livros-atribuicoes]", error);
  return {
    status: "error",
    message: "Não foi possível salvar. Tente de novo.",
  };
}

const pathOf = (attribution: string, book: string) =>
  `/admin/atribuicoes/${attribution}/livros/${book}`;

function rawOf(formData: FormData): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const [k, v] of formData.entries())
    if (typeof v === "string") raw[k] = v;
  return raw;
}

/** Lança a line in the book, or changes it (the reason goes to history). */
export async function saveBookEntryAction(
  _previous: BookState,
  formData: FormData,
): Promise<BookState> {
  const ok = await access("attributions.import", formData);
  if (!ok) return DENIED;
  const id = String(formData.get("id") ?? "");
  if (id) {
    const why = justify(formData);
    if (why) return { status: "error", message: why };
  }
  try {
    const input = readEntry(ok.book, rawOf(formData), officeToday());
    if (id) {
      await updateBookEntryWith(
        db,
        ok.tenant.slug,
        ok.book,
        id,
        input,
        String(formData.get("justificativa") ?? ""),
        ok.actor,
      );
    } else {
      await createBookEntryWith(db, ok.tenant.slug, ok.book, input, ok.actor);
    }
  } catch (error) {
    return failure(error);
  }
  revalidatePath(pathOf(ok.book.attribution, ok.book.key));
  return {
    status: "success",
    message: id
      ? "Lançamento alterado; o anterior ficou no histórico."
      : "Lançamento incluído no livro.",
  };
}

export async function setBookEntryDeletedAction(
  _previous: BookState,
  formData: FormData,
): Promise<BookState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access("attributions.import", formData);
  if (!ok) return DENIED;
  const asked = await askApproval(
    "attributions.book-entry",
    formData,
    `Lançamento do ${ok.book.name}`,
  );
  if (asked) return asked;
  const deleted = String(formData.get("op") ?? "") !== "restore";
  try {
    await setBookEntryDeletedWith(
      db,
      ok.tenant.slug,
      ok.book,
      String(formData.get("id") ?? ""),
      deleted,
      String(formData.get("justificativa") ?? ""),
      ok.actor,
    );
  } catch (error) {
    return failure(error);
  }
  revalidatePath(pathOf(ok.book.attribution, ok.book.key));
  return {
    status: "success",
    message: deleted
      ? "Lançamento apagado da lista. Ele continua guardado e pode ser restaurado."
      : "Lançamento restaurado.",
  };
}

/**
 * Imports one or more files (.xlsx, .csv, .ods, .json) into the books of an
 * attribution. `livro` names the book, or "auto": each file goes to the
 * book its columns show (decision of 27/11/2026: "pergunte qual livro é, ou
 * dar a opção de importar tudo e o sistema faz a distinção").
 */
export async function importBooksAction(
  _previous: BookState,
  formData: FormData,
): Promise<BookState> {
  const session = await getSession();
  if (
    !session ||
    !can(
      session.user.role ?? "",
      "attributions.import",
      session.user.permissions,
    )
  ) {
    return DENIED;
  }
  const attribution = String(formData.get("atribuicao") ?? "");
  const chosen = String(formData.get("livro") ?? "auto");
  const modeRaw = String(formData.get("modo") ?? "novos");
  const mode = (modeRaw in IMPORT_MODES ? modeRaw : "novos") as ImportMode;
  const files = formData
    .getAll("arquivo")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, 20);
  if (!files.length) return { status: "error", message: "Escolha o arquivo." };
  const tenant = await getTenant();
  const actor = { id: session.user.id };
  const lines: string[] = [];
  let anyIn = false;
  for (const file of files) {
    try {
      const isJson = /\.json$/i.test(file.name);
      const text = isJson ? await file.text() : "";
      const rows = isJson ? null : await sheetRows(file);
      const header = rows ? (rows[0] ?? []) : jsonHeader(text);
      const book =
        chosen === "auto"
          ? detectBook(attribution, header, file.name)
          : (bookOf(attribution, chosen) ?? null);
      if (!book) {
        lines.push(
          `${file.name}: não deu para saber de qual livro é. Escolha o livro na lista e envie de novo.`,
        );
        continue;
      }
      const table = rows ?? rowsOfJson(book, text);
      const reading = readBookRows(book, table, officeToday());
      const r = await importBookEntriesWith(
        db,
        tenant.slug,
        book,
        reading.items,
        mode,
        actor,
      );
      anyIn ||= reading.items.length > 0;
      const verb = mode === "conferir" ? "entrariam" : "entraram";
      lines.push(
        `${file.name} → ${book.name}: ${r.created} novos ${verb}; ${r.completed} ${mode === "novos" ? "já existiam" : "com campos vazios completados"}; ${r.unchanged} sem mudança${reading.errors.length ? `; ${reading.errors.length} linhas com problema (${reading.errors.slice(0, 3).join(" ")})` : ""}.`,
      );
      if (mode !== "conferir") {
        revalidatePath(pathOf(book.attribution, book.key));
      }
    } catch (error) {
      lines.push(
        `${file.name}: ${failure(error).status === "error" ? (failure(error) as { message: string }).message : "não foi possível ler."}`,
      );
    }
  }
  if (mode === "conferir") lines.push("Nada foi gravado.");
  revalidatePath(`/admin/atribuicoes/${attribution}`);
  return {
    status: anyIn ? "success" : "error",
    message: lines.join(" "),
  };
}

/** The keys of the first lançamento of a JSON export: its header. */
function jsonHeader(text: string): string[] {
  try {
    const parsed = JSON.parse(text) as unknown;
    const list = Array.isArray(parsed)
      ? parsed
      : ((parsed as { lancamentos?: unknown[] })?.lancamentos ?? []);
    const first = list[0];
    return first && typeof first === "object" ? Object.keys(first) : [];
  } catch {
    return [];
  }
}
