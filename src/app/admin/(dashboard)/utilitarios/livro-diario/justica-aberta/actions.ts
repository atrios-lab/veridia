"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import { parseSemester } from "@/core/daily-book/justica-aberta.ts";
import { LONG_TEXT_MAX } from "@/core/text-limits.ts";
import { parseMoneyBRL } from "@/core/transparency/bulletin.ts";
import { db } from "@/db/index.ts";
import { justify } from "@/lib/audit-reason.ts";
import { DailyBookError } from "@/lib/daily-book.ts";
import {
  removeFcrcpnRepasseWith,
  saveFcrcpnRepasseWith,
  setFcrcpnNoneWith,
} from "@/lib/daily-book-justica-aberta.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export type JusticaAbertaFormState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

const HOME = "/admin/utilitarios/livro-diario/justica-aberta";
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

function fail(error: unknown): JusticaAbertaFormState {
  if (error instanceof DailyBookError) {
    return { status: "error", message: error.message };
  }
  console.error("daily-book.justica-aberta", error);
  return {
    status: "error",
    message: "Não foi possível salvar agora. Tente de novo em instantes.",
  };
}

/** A repasse of the FCRCPN, new or (`id`) corrected. */
export async function saveFcrcpn(
  _previous: JusticaAbertaFormState,
  formData: FormData,
): Promise<JusticaAbertaFormState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const received = parseMoneyBRL(field(formData, "recebido", 20));
  const withheldText = field(formData, "retido", 20);
  const withheld = withheldText ? parseMoneyBRL(withheldText) : 0;
  if (received === null || received === 0) {
    return {
      status: "error",
      message: "Informe o valor recebido (ex.: 1.234,56).",
    };
  }
  if (withheld === null) {
    return { status: "error", message: "Confira o imposto retido." };
  }
  const id = field(formData, "id", 40) || undefined;
  try {
    await saveFcrcpnRepasseWith(
      db,
      ok.tenant.slug,
      {
        receivedOn: field(formData, "recebidoEm", 10),
        competence: field(formData, "competencia", 7),
        payer: field(formData, "pagador", 120),
        receivedCents: received,
        withheldCents: withheld,
        notes: field(formData, "observacoes", LONG_TEXT_MAX),
      },
      ok.session.user.id,
      id,
    );
  } catch (error) {
    return fail(error);
  }
  revalidatePath(HOME);
  return {
    status: "saved",
    message: id ? "Repasse corrigido." : "Repasse lançado.",
  };
}

/** Removed with a reason; it stays stored. */
export async function removeFcrcpn(
  _previous: JusticaAbertaFormState,
  formData: FormData,
): Promise<JusticaAbertaFormState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const problem = justify(formData);
  if (problem) return { status: "error", message: problem };
  try {
    await removeFcrcpnRepasseWith(
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
  return {
    status: "saved",
    message: "Repasse excluído. Ele continua guardado.",
  };
}

/** "Não houve repasse neste semestre", or that undone. */
export async function declareNoFcrcpn(
  _previous: JusticaAbertaFormState,
  formData: FormData,
): Promise<JusticaAbertaFormState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const semester = parseSemester(field(formData, "semestre", 10));
  if (!semester) return { status: "error", message: "Confira o semestre." };
  const none = formData.get("nenhum") === "sim";
  try {
    await setFcrcpnNoneWith(
      db,
      ok.tenant.slug,
      semester.id,
      none,
      ok.session.user.id,
    );
  } catch (error) {
    return fail(error);
  }
  revalidatePath(HOME);
  return {
    status: "saved",
    message: none
      ? "Registrado: sem repasse do FCRCPN neste semestre."
      : "Declaração desfeita.",
  };
}
