"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { parseAnswer, progress } from "@/core/compliance/answers.ts";
import { findSection, SECTIONS } from "@/core/compliance/sections.ts";
import {
  addAttachments,
  loadIntake,
  removeAttachment,
  saveAnswer,
  submitIntake,
  touchSection,
} from "@/lib/compliance.ts";
import { sendComplianceSubmittedEmails } from "@/lib/email/compliance.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import {
  AttachmentError,
  deleteStoredFile,
  storeAttachments,
} from "@/lib/uploads.ts";

const NO_PERMISSION =
  "Você não tem permissão para responder por esta serventia.";
const GENERIC_ERROR =
  "Não foi possível salvar agora. Tente novamente em instantes.";

/**
 * Hiding the screen is not the check; this is. Every action starts here, on
 * the server, and refuses anyone without `content.edit` in this office.
 */
async function authorize() {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "content.edit")) return null;
  return { session, tenant: await getTenant() };
}

export type SaveAnswerResult =
  | { status: "saved" }
  | { status: "error"; message: string };

/**
 * One field, saved the moment the office leaves it. The value is parsed
 * against the field's own definition (options, CPF digits, e-mail shape),
 * never trusted from the browser.
 */
export async function saveAnswerAction(
  sectionId: string,
  name: string,
  value: unknown,
): Promise<SaveAnswerResult> {
  const auth = await authorize();
  if (!auth) return { status: "error", message: NO_PERMISSION };

  const section = findSection(sectionId);
  const field = section?.fields.find((f) => f.name === name);
  if (!section || !field) {
    return { status: "error", message: "Campo desconhecido." };
  }

  const { answers } = await loadIntake(auth.tenant);
  const parsed = parseAnswer(field, value, { answers });
  if ("error" in parsed) return { status: "error", message: parsed.error };

  try {
    await saveAnswer(
      auth.tenant.slug,
      section.id,
      field.name,
      parsed.value,
      auth.session.user.id,
    );
  } catch (error) {
    console.error("adequacao.save", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/admin/adequacao");
  revalidatePath("/admin");
  return { status: "saved" };
}

/**
 * "Próxima seção": records the visit, which is what completes a prefilled
 * section or Anexos, and moves on. Nothing else is saved here; the fields
 * already saved themselves.
 */
export async function completeSectionAction(formData: FormData): Promise<void> {
  const auth = await authorize();
  if (!auth) redirect("/admin/adequacao");

  const sectionId = String(formData.get("sectionId") ?? "");
  const section = findSection(sectionId);
  if (!section) redirect("/admin/adequacao");

  await touchSection(auth.tenant.slug, section.id, auth.session.user.id);
  revalidatePath("/admin/adequacao");
  revalidatePath("/admin");

  const index = SECTIONS.indexOf(section);
  const next = SECTIONS[index + 1];
  redirect(next ? `/admin/adequacao/${next.id}` : "/admin/adequacao/revisao");
}

export type SubmitState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "sent"; version: number };

export async function submitIntakeAction(
  _previous: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const auth = await authorize();
  if (!auth) return { status: "error", message: NO_PERMISSION };

  if (formData.get("declaration") !== "on") {
    return {
      status: "error",
      message: "Marque a declaração para enviar.",
    };
  }

  const { intake, answers } = await loadIntake(auth.tenant);
  if (!progress(answers, intake.sectionUpdatedAt).ready) {
    return {
      status: "error",
      message:
        "Ainda há seções por concluir. Volte à lista e complete o que falta.",
    };
  }

  let version: number;
  try {
    ({ version } = await submitIntake(auth.tenant.slug, auth.session.user.id));
  } catch (error) {
    console.error("adequacao.submit", error);
    return { status: "error", message: GENERIC_ERROR };
  }

  const host = auth.tenant.hosts[0];
  await sendComplianceSubmittedEmails({
    tenant: auth.tenant,
    submitterName: auth.session.user.name?.trim() || auth.session.user.email,
    version,
    panelUrl: `https://${host}/admin/adequacao`,
  });

  revalidatePath("/admin/adequacao");
  revalidatePath("/admin");
  return { status: "sent", version };
}

export type AttachmentState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

export async function uploadAttachmentsAction(
  _previous: AttachmentState,
  formData: FormData,
): Promise<AttachmentState> {
  const auth = await authorize();
  if (!auth) return { status: "error", message: NO_PERMISSION };

  const kind = String(formData.get("kind") ?? "").trim() || "Outro documento";
  const files = formData
    .getAll("arquivo")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    return { status: "error", message: "Escolha ao menos um arquivo." };
  }

  try {
    const stored = await storeAttachments(files, {
      tenantSlug: auth.tenant.slug,
      kind,
    });
    await addAttachments(auth.tenant.slug, stored, auth.session.user.id);
  } catch (error) {
    if (error instanceof AttachmentError) {
      return { status: "error", message: error.message };
    }
    console.error("adequacao.upload", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/admin/adequacao");
  return { status: "success" };
}

export async function deleteAttachmentAction(
  _previous: AttachmentState,
  formData: FormData,
): Promise<AttachmentState> {
  const auth = await authorize();
  if (!auth) return { status: "error", message: NO_PERMISSION };

  const id = String(formData.get("attachmentId") ?? "");
  try {
    const removed = await removeAttachment(
      auth.tenant.slug,
      id,
      auth.session.user.id,
    );
    if (removed) await deleteStoredFile(removed.path);
  } catch (error) {
    console.error("adequacao.delete-attachment", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/admin/adequacao");
  return { status: "success" };
}
