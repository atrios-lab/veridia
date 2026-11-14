"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  competenceOf,
  FORM_KEYS,
  type Service,
  transferFromForm,
  transferToForm,
} from "@/core/titularidade/titularidade.ts";
import { db } from "@/db/index.ts";
import { currentJustification, justify } from "@/lib/audit-reason.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import {
  createFilingWith,
  createTransferWith,
  markSentWith,
  removeFilingWith,
  removeTransferWith,
  TitularidadeError,
  updateTransferWith,
} from "@/lib/title-transfers.ts";
import { readTitleFile } from "@/lib/titularidade-reading.ts";
import { AttachmentError, storeAttachments } from "@/lib/uploads.ts";

export type TitularidadeState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "read";
      message: string;
      values: Record<string, string>;
      sourceName: string;
      /** Changes on every reading, so the form takes the new values. */
      stamp: number;
    };

const NO_PERMISSION =
  "Você não tem permissão para a comunicação de titularidade à prefeitura. Peça ao Tabelião em Perfis e permissões.";
const GENERIC = "Não foi possível salvar agora. Tente de novo em instantes.";
const BASE = "/admin/utilitarios/titularidade";

async function access() {
  const session = await getSession();
  if (
    !session ||
    !can(
      session.user.role ?? "",
      "titularidade.manage",
      session.user.permissions,
    )
  ) {
    return undefined;
  }
  return { session, tenant: await getTenant() };
}

function formOf(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    FORM_KEYS.map((key) => [key, String(formData.get(key) ?? "")]),
  );
}

function failure(error: unknown, where: string): TitularidadeState {
  if (error instanceof TitularidadeError) {
    return { status: "error", message: error.message };
  }
  console.error(where, error);
  return { status: "error", message: GENERIC };
}

/** Reads the escritura or the registro and returns the fields filled. */
export async function readTitleAction(
  _previous: TitularidadeState,
  formData: FormData,
): Promise<TitularidadeState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const file = formData.get("arquivo");
  if (!(file instanceof File) || file.size === 0) {
    return {
      status: "error",
      message: "Escolha o arquivo da escritura ou do registro.",
    };
  }
  const service: Service = formData.get("service") === "ri" ? "ri" : "notas";
  const reading = await readTitleFile(file, service);
  // What the person already typed stays where the file says nothing.
  const typed = formOf(formData);
  const read = transferToForm(reading.transfer);
  const values = Object.fromEntries(
    FORM_KEYS.map((key) => [key, read[key] || typed[key] || ""]),
  );
  return {
    status: "read",
    message: reading.note,
    values,
    sourceName: file.name,
    stamp: Date.now(),
  };
}

export async function saveTransferAction(
  _previous: TitularidadeState,
  formData: FormData,
): Promise<TitularidadeState> {
  const id = String(formData.get("id") ?? "");
  if (id) {
    const why = justify(formData);
    if (why) return { status: "error", message: why };
  }
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const { transfer, problems } = transferFromForm(formOf(formData));
  if (problems.length > 0) {
    return { status: "error", message: problems.join(" ") };
  }
  try {
    if (id) {
      await updateTransferWith(
        db,
        ok.tenant.slug,
        id,
        transfer,
        ok.session.user.id,
        currentJustification() ?? "",
      );
    } else {
      await createTransferWith(
        db,
        ok.tenant.slug,
        transfer,
        String(formData.get("sourceName") ?? ""),
        ok.session.user.id,
      );
    }
  } catch (error) {
    return failure(error, "titularidade.save");
  }
  revalidatePath(BASE);
  redirect(`${BASE}?mes=${competenceOf(transfer.actDate)}&salvo=1`);
}

export async function removeTransferAction(
  _previous: TitularidadeState,
  formData: FormData,
): Promise<TitularidadeState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const mes = String(formData.get("mes") ?? "");
  try {
    await removeTransferWith(
      db,
      ok.tenant.slug,
      String(formData.get("id") ?? ""),
      ok.session.user.id,
      currentJustification() ?? "",
    );
  } catch (error) {
    return failure(error, "titularidade.remove");
  }
  revalidatePath(BASE);
  redirect(`${BASE}?mes=${mes}`);
}

export async function createFilingAction(
  _previous: TitularidadeState,
  formData: FormData,
): Promise<TitularidadeState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  let id = "";
  try {
    id = await createFilingWith(
      db,
      ok.tenant.slug,
      String(formData.get("mes") ?? ""),
      today(),
      ok.session.user.id,
    );
  } catch (error) {
    return failure(error, "titularidade.filing");
  }
  revalidatePath(BASE);
  redirect(`${BASE}/oficios/${id}`);
}

export async function markSentAction(
  _previous: TitularidadeState,
  formData: FormData,
): Promise<TitularidadeState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const id = String(formData.get("id") ?? "");
  try {
    const file = formData.get("recibo");
    const [stored] =
      file instanceof File && file.size > 0
        ? await storeAttachments([file], {
            tenantSlug: ok.tenant.slug,
            kind: "Recibo de entrega",
            limit: 1,
          })
        : [];
    await markSentWith(
      db,
      ok.tenant.slug,
      id,
      {
        sentOn: String(formData.get("sentOn") ?? ""),
        channel: String(formData.get("channel") ?? ""),
        receipt: String(formData.get("receipt") ?? ""),
        receiptFile:
          stored && file instanceof File
            ? { path: stored.path, name: file.name || "recibo.pdf" }
            : undefined,
        semutOn: String(formData.get("semutOn") ?? ""),
        semutReceipt: String(formData.get("semutReceipt") ?? ""),
      },
      ok.session.user.id,
    );
  } catch (error) {
    if (error instanceof AttachmentError) {
      return { status: "error", message: error.message };
    }
    return failure(error, "titularidade.sent");
  }
  revalidatePath(`${BASE}/oficios/${id}`);
  revalidatePath(BASE);
  redirect(`${BASE}/oficios/${id}?enviado=1`);
}

export async function removeFilingAction(
  _previous: TitularidadeState,
  formData: FormData,
): Promise<TitularidadeState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  try {
    await removeFilingWith(
      db,
      ok.tenant.slug,
      String(formData.get("id") ?? ""),
      ok.session.user.id,
      currentJustification() ?? "",
    );
  } catch (error) {
    return failure(error, "titularidade.filing-remove");
  }
  revalidatePath(BASE);
  redirect(BASE);
}
