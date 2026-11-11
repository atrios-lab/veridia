"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import { NUMBER_SERIES, type NumberSeries } from "@/core/numbering/series.ts";
import { db } from "@/db/index.ts";
import { justify } from "@/lib/audit-reason.ts";
import {
  clearNumberingFloorWith,
  NumberingError,
  saveNumberingFloorWith,
} from "@/lib/document-numbering.ts";
import {
  IssDeclarationError,
  removeIssDeclarationWith,
  renumberIssDeclarationWith,
} from "@/lib/iss-declarations.ts";
import { getSession } from "@/lib/session.ts";
import {
  deleteGuideWith,
  GuideNumberTakenError,
  renumberGuideWith,
} from "@/lib/tax-guides.ts";
import { getTenant } from "@/lib/tenant.ts";

export type NumberingState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

/** Where one numbered document goes on, in one year. */
export async function saveNumbering(
  _previous: NumberingState,
  formData: FormData,
): Promise<NumberingState> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "numbering.manage", session.user.permissions)
  ) {
    return {
      status: "error",
      message: "Você não tem permissão para alterar a numeração.",
    };
  }
  const series = String(formData.get("series") ?? "");
  if (!(NUMBER_SERIES as readonly string[]).includes(series)) {
    return { status: "error", message: "Documento desconhecido." };
  }
  const year = Number(formData.get("year"));
  const next = Number(formData.get("next"));
  const tenant = await getTenant();
  try {
    await saveNumberingFloorWith(
      db,
      tenant.slug,
      series as NumberSeries,
      year,
      next,
      session.user.id,
    );
  } catch (error) {
    if (error instanceof NumberingError) {
      return { status: "error", message: error.message };
    }
    console.error("numeracao.save", error);
    return {
      status: "error",
      message: "Não foi possível salvar agora. Tente novamente.",
    };
  }
  revalidatePath("/admin/configuracoes/numeracao");
  return { status: "saved", message: "Numeração salva." };
}

async function manager(
  permission: "numbering.manage" | "guides.manage" | "iss.manage",
) {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", permission, session.user.permissions)
  ) {
    return undefined;
  }
  return { session, tenant: await getTenant() };
}

const NO_PERMISSION = "Você não tem permissão para alterar a numeração.";

/** Back to counting on its own: drops the number set by hand for the year. */
export async function clearNumbering(
  _previous: NumberingState,
  formData: FormData,
): Promise<NumberingState> {
  const ok = await manager("numbering.manage");
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const series = String(formData.get("series") ?? "");
  if (!(NUMBER_SERIES as readonly string[]).includes(series)) {
    return { status: "error", message: "Documento desconhecido." };
  }
  await clearNumberingFloorWith(
    db,
    ok.tenant.slug,
    series as NumberSeries,
    Number(formData.get("year")),
    ok.session.user.id,
  );
  revalidatePath("/admin/configuracoes/numeracao");
  return { status: "saved", message: "A numeração voltou a ser automática." };
}

/** The series whose issued documents this screen edits. */
const EDITABLE = ["guia", "declaracao-iss"] as const;
type Editable = (typeof EDITABLE)[number];

function editableSeries(formData: FormData): Editable | undefined {
  const series = String(formData.get("series") ?? "");
  return (EDITABLE as readonly string[]).includes(series)
    ? (series as Editable)
    : undefined;
}

/** Another number for an issued guia or declaration, with the reason. */
export async function renumberIssued(
  _previous: NumberingState,
  formData: FormData,
): Promise<NumberingState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const series = editableSeries(formData);
  const ok = await manager(series === "guia" ? "guides.manage" : "iss.manage");
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const id = String(formData.get("id") ?? "");
  const sequence = Number(formData.get("sequence"));
  const year = Number(formData.get("year"));
  if (!series || !/^[0-9a-f-]{36}$/i.test(id)) {
    return { status: "error", message: "Documento desconhecido." };
  }
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 99_999) {
    return {
      status: "error",
      message: "Informe o número de ordem (1 ou mais).",
    };
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { status: "error", message: "Informe o ano com quatro dígitos." };
  }
  try {
    if (series === "guia") {
      const done = await renumberGuideWith(
        db,
        ok.tenant.slug,
        id,
        year,
        sequence,
        ok.session.user.id,
      );
      if (!done) return { status: "error", message: "Guia não encontrada." };
    } else {
      await renumberIssDeclarationWith(
        db,
        ok.tenant.slug,
        id,
        year,
        sequence,
        ok.session.user.id,
      );
    }
  } catch (error) {
    if (error instanceof GuideNumberTakenError) {
      return {
        status: "error",
        message: `Já existe outra guia com o número ${String(sequence).padStart(3, "0")}/${year}.`,
      };
    }
    if (error instanceof IssDeclarationError) {
      return { status: "error", message: error.message };
    }
    console.error("numeracao.renumber", error);
    return { status: "error", message: "Não foi possível salvar agora." };
  }
  revalidatePath("/admin/configuracoes/numeracao");
  revalidatePath(
    series === "guia" ? "/admin/utilitarios/guias" : "/admin/utilitarios/iss",
  );
  return { status: "saved", message: "Número alterado." };
}

/**
 * "Excluir" from here (a test, a mistake): the document leaves the lists
 * and its number is free again. Nothing is erased from the database: the
 * row stays, marked, with the reason in the audit.
 */
export async function removeIssued(
  _previous: NumberingState,
  formData: FormData,
): Promise<NumberingState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const series = editableSeries(formData);
  const ok = await manager(series === "guia" ? "guides.manage" : "iss.manage");
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const id = String(formData.get("id") ?? "");
  if (!series) return { status: "error", message: "Documento desconhecido." };
  try {
    if (series === "guia") {
      const done = await deleteGuideWith(
        db,
        ok.tenant.slug,
        id,
        ok.session.user.id,
      );
      if (!done) return { status: "error", message: "Guia não encontrada." };
    } else {
      await removeIssDeclarationWith(
        db,
        ok.tenant.slug,
        id,
        ok.session.user.id,
      );
    }
  } catch {
    return { status: "error", message: "Não foi possível excluir agora." };
  }
  revalidatePath("/admin", "layout");
  return { status: "saved", message: "Excluído. O número ficou livre." };
}
