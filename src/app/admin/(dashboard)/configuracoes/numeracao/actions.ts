"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import { NUMBER_SERIES, type NumberSeries } from "@/core/numbering/series.ts";
import { db } from "@/db/index.ts";
import {
  NumberingError,
  saveNumberingFloorWith,
} from "@/lib/document-numbering.ts";
import { getSession } from "@/lib/session.ts";
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
    !can(session.user.role ?? "", "content.edit", session.user.permissions)
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
