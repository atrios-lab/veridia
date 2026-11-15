"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  type Attribution,
  isAttribution,
  qualificationFrom,
} from "@/core/qualificacao/qualificacao.ts";
import { db } from "@/db/index.ts";
import { currentJustification, justify } from "@/lib/audit-reason.ts";
import {
  createLibraryItemWith,
  createQualificationWith,
  issueNoteWith,
  markLibraryItemWith,
  markQualificationWith,
  QualificationError,
  reexamWith,
  removeNoteWith,
  renumberNoteWith,
  saveQualificationWith,
  updateLibraryItemWith,
} from "@/lib/qualificacao.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, today } from "@/lib/tenant.ts";

export type QualificationState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "saved"; message: string };

const BASE = "/admin/utilitarios/qualificacao";
const NO_PERMISSION =
  "Você não tem permissão para a qualificação de títulos. Peça ao Tabelião em Perfis e permissões.";
const GENERIC = "Não foi possível salvar agora. Tente de novo em instantes.";

async function access() {
  const session = await getSession();
  if (
    !session ||
    !can(
      session.user.role ?? "",
      "qualificacao.manage",
      session.user.permissions,
    )
  ) {
    return undefined;
  }
  return { session, tenant: await getTenant() };
}

function failure(error: unknown, where: string): QualificationState {
  if (error instanceof QualificationError) {
    return { status: "error", message: error.message };
  }
  console.error(where, error);
  return { status: "error", message: GENERIC };
}

const field = (formData: FormData, name: string) =>
  String(formData.get(name) ?? "").trim();

/** The whole qualificação, sent by the editor as JSON. */
function dataOf(formData: FormData) {
  try {
    return qualificationFrom(JSON.parse(field(formData, "data") || "{}"));
  } catch {
    throw new QualificationError("Dados da qualificação inválidos.");
  }
}

export async function createAction(
  _previous: QualificationState,
  formData: FormData,
): Promise<QualificationState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  let id = "";
  try {
    id = await createQualificationWith(
      db,
      ok.tenant.slug,
      dataOf(formData),
      ok.session.user.id,
    );
  } catch (error) {
    return failure(error, "qualificacao.create");
  }
  revalidatePath(BASE);
  redirect(`${BASE}/${id}`);
}

/**
 * The editor's save: the open round's exigências, the fundamentos, the
 * observações or the presentation. With a note issued, it asks why.
 */
export async function saveAction(
  _previous: QualificationState,
  formData: FormData,
): Promise<QualificationState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const id = field(formData, "id");
  try {
    await saveQualificationWith(
      db,
      ok.tenant.slug,
      id,
      dataOf(formData),
      ok.session.user.id,
      field(formData, "justificativa"),
    );
  } catch (error) {
    return failure(error, "qualificacao.edit");
  }
  revalidatePath(`${BASE}/${id}`);
  if (field(formData, "voltar") === "ficha") redirect(`${BASE}/${id}`);
  return { status: "saved", message: "Qualificação salva." };
}

export async function issueAction(
  _previous: QualificationState,
  formData: FormData,
): Promise<QualificationState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const id = field(formData, "id");
  const kind =
    field(formData, "tipo") === "positiva" ? "positiva" : "devolutiva";
  try {
    await issueNoteWith(
      db,
      ok.tenant.slug,
      id,
      kind,
      {
        issuedOn: field(formData, "data") || today(),
        signer: {
          name: field(formData, "assinante"),
          role: field(formData, "cargo"),
        },
      },
      ok.session.user.id,
    );
  } catch (error) {
    return failure(error, "qualificacao.issue");
  }
  revalidatePath(BASE);
  redirect(`${BASE}/${id}?emitida=${kind}`);
}

export async function reexamAction(
  _previous: QualificationState,
  formData: FormData,
): Promise<QualificationState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const id = field(formData, "id");
  try {
    await reexamWith(
      db,
      ok.tenant.slug,
      id,
      field(formData, "documentos"),
      field(formData, "data") || today(),
      ok.session.user.id,
    );
  } catch (error) {
    return failure(error, "qualificacao.reexam");
  }
  revalidatePath(BASE);
  redirect(`${BASE}/${id}`);
}

export async function removeNoteAction(
  _previous: QualificationState,
  formData: FormData,
): Promise<QualificationState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  let id = "";
  try {
    id = await removeNoteWith(
      db,
      ok.tenant.slug,
      field(formData, "id"),
      currentJustification() ?? "",
      ok.session.user.id,
    );
  } catch (error) {
    return failure(error, "qualificacao.note-remove");
  }
  revalidatePath(BASE);
  redirect(`${BASE}/${id}`);
}

export async function renumberNoteAction(
  _previous: QualificationState,
  formData: FormData,
): Promise<QualificationState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  try {
    await renumberNoteWith(
      db,
      ok.tenant.slug,
      field(formData, "id"),
      Number.parseInt(field(formData, "sequence"), 10),
      currentJustification() ?? "",
      ok.session.user.id,
    );
  } catch (error) {
    return failure(error, "qualificacao.note-renumber");
  }
  revalidatePath(BASE);
  redirect(`${BASE}/${field(formData, "qualificacao")}`);
}

export async function markAction(
  _previous: QualificationState,
  formData: FormData,
): Promise<QualificationState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const id = field(formData, "id");
  const restore = field(formData, "estornar") === "1";
  try {
    await markQualificationWith(
      db,
      ok.tenant.slug,
      id,
      currentJustification() ?? "",
      ok.session.user.id,
      restore,
    );
  } catch (error) {
    return failure(error, "qualificacao.mark");
  }
  revalidatePath(BASE);
  redirect(restore ? `${BASE}/${id}` : BASE);
}

// ---------------------------------------------------------------- library

function libraryInput(formData: FormData) {
  const attribution = field(formData, "atribuicao");
  return {
    attribution: (isAttribution(attribution)
      ? attribution
      : "rcpn") as Attribution,
    acts: formData.getAll("atos").map(String),
    title: field(formData, "titulo"),
    description: field(formData, "descricao"),
    howToComply: field(formData, "cumprimento"),
    basis: field(formData, "fundamento"),
  };
}

export async function saveLibraryAction(
  _previous: QualificationState,
  formData: FormData,
): Promise<QualificationState> {
  const id = field(formData, "id");
  if (id) {
    const why = justify(formData);
    if (why) return { status: "error", message: why };
  }
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const input = libraryInput(formData);
  try {
    if (id) {
      await updateLibraryItemWith(
        db,
        ok.tenant.slug,
        id,
        input,
        currentJustification() ?? "",
        ok.session.user.id,
      );
    } else {
      await createLibraryItemWith(
        db,
        ok.tenant.slug,
        input,
        ok.session.user.id,
      );
    }
  } catch (error) {
    return failure(error, "qualificacao.library");
  }
  revalidatePath(`${BASE}/biblioteca`);
  redirect(`${BASE}/biblioteca?atribuicao=${input.attribution}`);
}

export async function markLibraryAction(
  _previous: QualificationState,
  formData: FormData,
): Promise<QualificationState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const restore = field(formData, "estornar") === "1";
  try {
    await markLibraryItemWith(
      db,
      ok.tenant.slug,
      field(formData, "id"),
      currentJustification() ?? "",
      ok.session.user.id,
      restore,
    );
  } catch (error) {
    return failure(error, "qualificacao.library-mark");
  }
  revalidatePath(`${BASE}/biblioteca`);
  redirect(
    `${BASE}/biblioteca?atribuicao=${field(formData, "atribuicao") || "rcpn"}`,
  );
}
