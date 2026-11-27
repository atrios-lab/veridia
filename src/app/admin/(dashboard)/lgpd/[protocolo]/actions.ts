"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import {
  APPROVAL_NEEDED,
  alignmentTranscript,
  mayAnswer,
} from "@/core/dpo/alinhamento.ts";
import { DPO_COPY } from "@/core/dpo/copy.ts";
import { parseDetails } from "@/core/request/kinds.ts";
import { db } from "@/db/index.ts";
import { askApproval } from "@/lib/approval.ts";
import { justify } from "@/lib/audit-reason.ts";
import {
  alignDataRightsWith,
  alignmentStoredWith,
  approveDataRightsReplyWith,
} from "@/lib/dpo/alignment.ts";
import { draftReplyWith } from "@/lib/dpo/assistant.ts";
import { autoDraftDataRightsWith, fillReply } from "@/lib/dpo/auto-draft.ts";
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
    // The final decision is the encarregado's or the Tabelião's (decision
    // of 15/11/2026): anyone else sends only the text they approved.
    const canDecide = can(
      session.user.role ?? "",
      "lgpd.decide",
      session.user.permissions,
    );
    if (
      request.kind === "data-rights" &&
      !mayAnswer(
        canDecide,
        parseDetails("data-rights", request.details).approval,
        reply,
      )
    ) {
      return { status: "error", message: APPROVAL_NEEDED };
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
  const asked = await askApproval(
    "lgpd.attachment",
    formData,
    "Anexo do requerimento LGPD",
  );
  if (asked) return asked;
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
    // Already gone if the 90-day rule purged it: only the row was left.
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
  const typed = String(formData.get("note") ?? "").trim();
  const aligned = alignmentTranscript(
    await alignmentStoredWith(db, tenant.slug, request.id),
    3800 - typed.length,
  );
  const result = await draftReplyWith(db, dpoModels(), {
    tenantSlug: tenant.slug,
    userId: session.user.id,
    userRole: session.user.role ?? "",
    right,
    note: [aligned, typed].filter(Boolean).join("\n\n"),
    titularRequest: request.description ?? "",
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

export type AlignState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ok"; at: number };

async function assistSession() {
  const session = await authorize();
  if (
    !session ||
    !can(session.user.role ?? "", "dpo.assist", session.user.permissions)
  ) {
    return null;
  }
  return session;
}

/**
 * One turn of the conversation on the requerimento (decision of
 * 15/11/2026): the team writes, may attach a document for the Assistente
 * Virtual to read (read here and dropped), and it answers from the norms.
 * An empty first message opens the analysis.
 */
export async function alignAction(
  _previous: AlignState,
  formData: FormData,
): Promise<AlignState> {
  const session = await assistSession();
  if (!session) return { status: "error", message: NO_PERMISSION };
  if (await isDpoRateLimited(session.user.id)) {
    return { status: "error", message: DPO_COPY.rateLimited };
  }
  const tenant = await getTenant();
  const blocked = await dpoBlocked(tenant.slug);
  if (blocked) return { status: "error", message: blocked };

  // The document for the Assistente Virtual: read now, never stored.
  let fileText = "";
  const files = formData
    .getAll("paraAssistente")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, 3);
  if (files.length) {
    const read = await readKnowledgeFiles(files);
    fileText = read.documents
      .map((d) => d.markdown)
      .join("\n\n")
      .slice(0, 2500);
    if (!fileText.trim()) {
      return {
        status: "error",
        message: "Não foi possível ler o texto do arquivo anexado.",
      };
    }
  }

  const now = new Date();
  try {
    const result = await alignDataRightsWith(db, dpoModels(), {
      tenant,
      requestId: String(formData.get("requestId") ?? ""),
      userId: session.user.id,
      userRole: session.user.role ?? "",
      message: String(formData.get("message") ?? ""),
      fileText,
      officeContext: await officeContextFor(tenant, now),
      now,
    });
    if (result.status !== "ok") {
      return { status: "error", message: result.message };
    }
  } catch (error) {
    console.error("lgpd.align", error);
    return { status: "error", message: DPO_COPY.failed };
  }
  revalidateAdmin();
  return { status: "ok", at: now.getTime() };
}

/**
 * "Preparar a resposta com o que alinhamos": the draft from the
 * conversation, saved on the requerimento as the Assistente Virtual's.
 * A text a person already saved is never replaced.
 */
export async function prepareFromAlignmentAction(
  _previous: AlignState,
  formData: FormData,
): Promise<AlignState> {
  const session = await assistSession();
  if (!session) return { status: "error", message: NO_PERMISSION };
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
  if (!request || request.kind !== "data-rights" || request.status !== "new") {
    return { status: "error", message: "Requerimento não encontrado." };
  }
  const note = alignmentTranscript(
    await alignmentStoredWith(db, tenant.slug, request.id),
  );
  if (!note) {
    return {
      status: "error",
      message:
        "Converse com o Assistente Virtual antes de preparar a resposta.",
    };
  }
  let outcome: "drafted" | "skipped";
  try {
    outcome = await autoDraftDataRightsWith(
      db,
      dpoModels(),
      tenant,
      request.id,
      new Date(),
      officeContextFor,
      note,
      session.user.id,
    );
  } catch (error) {
    console.error("lgpd.prepare", error);
    return { status: "error", message: DPO_COPY.failed };
  }
  if (outcome !== "drafted") {
    return {
      status: "error",
      message:
        'A resposta não foi preparada: já há um texto salvo pela equipe (use "Rascunhar resposta" no campo da resposta para trocar) ou o limite do mês foi atingido.',
    };
  }
  revalidateAdmin();
  return { status: "ok", at: Date.now() };
}

/**
 * The final decision (`lgpd.decide`): the encarregado or the Tabelião
 * approves the draft as saved. Any later change needs a new approval.
 */
export async function approveReplyAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (
    !session ||
    !can(session.user.role ?? "", "lgpd.decide", session.user.permissions)
  ) {
    return {
      status: "error",
      message:
        "Só o encarregado de dados ou o Tabelião aprovam a resposta ao titular.",
    };
  }
  const tenant = await getTenant();
  const result = await approveDataRightsReplyWith(
    db,
    tenant.slug,
    String(formData.get("requestId") ?? ""),
    {
      id: session.user.id,
      name: session.user.name ?? "",
      role: session.user.role ?? "",
    },
  );
  if (result.status !== "ok") return result;
  revalidateAdmin();
  return { status: "success" };
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
