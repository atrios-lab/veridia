"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import { DPO_COPY } from "@/core/dpo/copy.ts";
import {
  intakeNote,
  intakeProblems,
  intakeQuestions,
} from "@/core/dpo/intake.ts";
import { maskPersonalData } from "@/core/dpo/mask.ts";
import { parseDetails } from "@/core/request/kinds.ts";
import { db } from "@/db/index.ts";
import { justify } from "@/lib/audit-reason.ts";
import { draftReplyWith } from "@/lib/dpo/assistant.ts";
import {
  autoDraftDataRightsWith,
  fillReply,
  saveDataRightsIntakeWith,
} from "@/lib/dpo/auto-draft.ts";
import { dpoBlocked, dpoModels } from "@/lib/dpo/models.ts";
import { officeContextFor } from "@/lib/dpo/office.ts";
import { notifyCitizen } from "@/lib/email/service-request.ts";
import { readKnowledgeFiles } from "@/lib/knowledge-reading.ts";
import { isDpoRateLimited } from "@/lib/rate-limit.ts";
import {
  AttachmentInUseError,
  attachToRequest,
  deleteAttachment,
  findById,
  respondToRecord,
  saveDraftReply,
} from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import {
  AttachmentError,
  deleteStoredFile,
  storeAttachments,
} from "@/lib/uploads.ts";

export type ActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  // `emailWarning` carries the one thing the operator cannot find out later:
  // that the citizen's address does not take mail. The record was saved
  // either way, so this is not an error, and it is not a badge on the page
  // either: it belongs to the moment someone tried to write.
  | { status: "success"; emailWarning?: string | null };

const NO_PERMISSION =
  "Você não tem permissão para responder este requerimento.";
const GENERIC_ERROR =
  "Não foi possível salvar agora. Tente novamente em instantes.";

/** Every action here re-checks on the server, same discipline as
 * `/admin/pedidos`: hiding the link and the page 404-ing are a courtesy. */
async function authorize() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "channels.manage", session.user.permissions)
  ) {
    return null;
  }
  return session;
}

function revalidateAdmin(): void {
  revalidatePath("/admin", "layout");
}

export async function respondDataRights(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const requestId = String(formData.get("requestId") ?? "");
  const reply = String(formData.get("reply") ?? "").trim();
  if (!reply) {
    return { status: "error", message: "Escreva a resposta antes de enviar." };
  }

  const tenant = await getTenant();
  let emailWarning: string | null = null;
  try {
    // Read before writing: the notice below needs the holder's e-mail and the
    // protocol number, and a `requestId` that matches nothing should be
    // refused here rather than written into silently.
    const request = await findById(tenant.slug, requestId);
    if (!request) {
      return { status: "error", message: "Requerimento não encontrado." };
    }

    const files = formData
      .getAll("relatorio")
      .filter((f): f is File => f instanceof File);
    const stored = await storeAttachments(files, {
      tenantSlug: tenant.slug,
      kind: "office",
      name: String(formData.get("relatorioName") ?? ""),
    });
    if (stored.length > 0) {
      await attachToRequest(tenant.slug, requestId, stored, "office");
    }
    await respondToRecord(
      tenant.slug,
      requestId,
      "data-rights",
      reply,
      "answered",
      session.user.id,
    );

    // The answer itself stays behind the key: a data rights requerimento
    // carries the holder's own personal data, and e-mail is the channel the
    // office does not control. Best effort, like every other notice here.
    emailWarning = await notifyCitizen({
      tenant,
      contact: request.contact,
      protocolNumber: request.protocolNumber,
      subject: "Requerimento respondido",
      body: "O Encarregado respondeu ao seu requerimento. Consulte o protocolo com a sua chave de acesso para ler a resposta.",
    });
  } catch (error) {
    if (error instanceof AttachmentError) {
      return { status: "error", message: error.message };
    }
    console.error("lgpd.respond", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success", emailWarning };
}

export async function saveDataRightsDraft(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const requestId = String(formData.get("requestId") ?? "");
  const draft = String(formData.get("reply") ?? "");

  const tenant = await getTenant();
  try {
    await saveDraftReply(
      tenant.slug,
      requestId,
      "data-rights",
      draft,
      session.user.id,
    );
  } catch (error) {
    console.error("lgpd.save-draft", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success" };
}

/**
 * Removes any file hanging off this requirement: the report the office
 * attached to its reply, or the document the holder sent to identify
 * themselves. Same reach the service request panel has.
 */
export async function deleteAttachmentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Sensitive: says why, and the reason goes to the audit.
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const requestId = String(formData.get("requestId") ?? "");
  const attachmentId = String(formData.get("attachmentId") ?? "");
  const tenant = await getTenant();
  try {
    const deleted = await deleteAttachment(
      tenant.slug,
      requestId,
      attachmentId,
      session.user.id,
    );
    if (!deleted) {
      return { status: "error", message: "Documento não encontrado." };
    }
    // Already gone if the 30-day rule purged it: only the row was left.
    if (deleted.path) await deleteStoredFile(deleted.path);
  } catch (error) {
    if (error instanceof AttachmentInUseError) {
      return { status: "error", message: error.message };
    }
    console.error("lgpd.delete-attachment", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success" };
}

export type DraftState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ok"; draft: string };

/**
 * "Rascunhar resposta" (change assistente-do-dpo): the DPO assistant writes
 * a draft from the right asked alone, with markers where the data subject's
 * data goes; the markers are filled in here, on the platform's server. The
 * data subject's name, text and protocol never reach the model. Nothing is
 * saved or sent: the draft goes back to the reply field for review.
 */
export async function draftDataRightsReply(
  _previous: DraftState,
  formData: FormData,
): Promise<DraftState> {
  const session = await authorize();
  if (
    !session ||
    !can(session.user.role ?? "", "dpo.assist", session.user.permissions)
  ) {
    return { status: "error", message: NO_PERMISSION };
  }
  if (await isDpoRateLimited(session.user.id)) {
    return { status: "error", message: DPO_COPY.rateLimited };
  }
  const tenant = await getTenant();
  const blocked = await dpoBlocked(tenant.slug);
  if (blocked) return { status: "error", message: blocked };
  const request = await findById(
    tenant.slug,
    String(formData.get("requestId") ?? ""),
  );
  if (!request || request.kind !== "data-rights") {
    return { status: "error", message: "Requerimento não encontrado." };
  }
  const { right } = parseDetails("data-rights", request.details);
  const now = new Date();
  const result = await draftReplyWith(db, dpoModels(), {
    tenantSlug: tenant.slug,
    userId: session.user.id,
    userRole: session.user.role ?? "",
    right,
    note: String(formData.get("note") ?? ""),
    officeContext: await officeContextFor(tenant, now),
    now,
  });
  if (result.status !== "ok") {
    return { status: "error", message: result.message };
  }
  return {
    status: "ok",
    draft: fillReply(result.draft, request, tenant),
  };
}

export type IntakeState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "saved"; drafted: boolean; message: string };

/**
 * The office answers the Assistente Virtual's questions (core/dpo/intake),
 * may attach a document for it to read (read here and dropped, its text
 * masked like the notes), and the draft is made from the answers. The
 * answers stay on the requerimento; the document does not.
 */
export async function answerIntakeAction(
  _previous: IntakeState,
  formData: FormData,
): Promise<IntakeState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const tenant = await getTenant();
  const request = await findById(
    tenant.slug,
    String(formData.get("requestId") ?? ""),
  );
  if (!request || request.kind !== "data-rights" || request.status !== "new") {
    return { status: "error", message: "Requerimento não encontrado." };
  }
  const details = parseDetails("data-rights", request.details);
  const answers: Record<string, { choice: string; note: string }> = {};
  for (const q of intakeQuestions(details.right)) {
    answers[q.id] = {
      choice: String(formData.get(`q-${q.id}`) ?? "").slice(0, 200),
      note: String(formData.get(`n-${q.id}`) ?? "")
        .trim()
        .slice(0, 1000),
    };
  }
  const intake = {
    answers,
    notes: String(formData.get("observacoes") ?? "")
      .trim()
      .slice(0, 4000),
  };
  const problems = intakeProblems(details.right, intake);
  if (problems.length) return { status: "error", message: problems[0] ?? "" };

  // The document for the Assistente Virtual: read now, never stored.
  let fromFile = "";
  const files = formData
    .getAll("paraAssistente")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, 3);
  if (files.length) {
    const read = await readKnowledgeFiles(files);
    fromFile = read.documents
      .map((d) => d.markdown)
      .join("\n\n")
      .slice(0, 2500);
  }

  await saveDataRightsIntakeWith(
    db,
    tenant.slug,
    request.id,
    {
      ...intake,
      answeredAt: new Date().toISOString(),
    },
    session.user.id,
  );

  let drafted = false;
  if (!(await dpoBlocked(tenant.slug))) {
    const note = maskPersonalData(
      [
        intakeNote(details.right, intake),
        fromFile
          ? `Trecho do documento anexado pela serventia:\n${fromFile}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    ).text;
    try {
      drafted =
        (await autoDraftDataRightsWith(
          db,
          dpoModels(),
          tenant,
          request.id,
          new Date(),
          officeContextFor,
          note,
        )) === "drafted";
    } catch (error) {
      console.error("lgpd.intake-draft", error);
    }
  }
  revalidateAdmin();
  return {
    status: "saved",
    drafted,
    message: drafted
      ? "Respostas salvas. O Assistente Virtual preparou o rascunho abaixo: revise antes de enviar."
      : "Respostas salvas. O rascunho não foi preparado agora (Assistente Virtual desligado, sem chave ou rascunho já escrito por alguém).",
  };
}

/**
 * A document the office sends to the titular, any time while the
 * requerimento is open (decision of 15/11/2026): it shows in the titular's
 * consult, behind the protocol and the key.
 */
export async function attachForTitularAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const tenant = await getTenant();
  const requestId = String(formData.get("requestId") ?? "");
  const request = await findById(tenant.slug, requestId);
  if (!request || request.kind !== "data-rights") {
    return { status: "error", message: "Requerimento não encontrado." };
  }
  const files = formData
    .getAll("paraTitular")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    return { status: "error", message: "Escolha o arquivo para o titular." };
  }
  try {
    const stored = await storeAttachments(files, {
      tenantSlug: tenant.slug,
      kind: "office",
      name: String(formData.get("paraTitularName") ?? ""),
    });
    await attachToRequest(tenant.slug, request.id, stored, "office");
  } catch (error) {
    if (error instanceof AttachmentError) {
      return { status: "error", message: error.message };
    }
    console.error("lgpd.attach-for-titular", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidateAdmin();
  return { status: "success" };
}
