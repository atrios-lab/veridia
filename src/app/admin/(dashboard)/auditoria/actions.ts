"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { officialName } from "@/core/tenant/identification.ts";
import { user } from "@/db/auth-schema.ts";
import { db } from "@/db/index.ts";
import {
  emailAnswerArrived,
  emailAuditReport,
  emailNotification,
  notificationNumber,
  renderAuditReportPdf,
  renderNotificationPdf,
} from "@/lib/audit-documents.ts";
import {
  addAuditNoteWith,
  answerNotificationWith,
  closeNotificationWith,
  createNotificationWith,
  editAuditNoteWith,
  findNotificationWith,
  listAuditWith,
  markNotificationEmailedWith,
  markReviewedWith,
  NotificationError,
  removeAuditNoteWith,
  setArchivedWith,
  setNotificationSignedWith,
} from "@/lib/audit-trail.ts";
import { CertificatePasswordError } from "@/lib/signature/certificate.ts";
import { requestOrigin, verifyUrlFor } from "@/lib/signature/documents.ts";
import { SigningError, signNewDocumentWith } from "@/lib/signing.ts";
import { AttachmentError, storeAttachments } from "@/lib/uploads.ts";
import { auditAccess, trailScope } from "./access.ts";

export type AuditState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

const DENIED: AuditState = { status: "error", message: "Sem permissão." };

/**
 * Marks acts as "lido e ok": an urgent one's alert ends, and every one
 * leaves its band for "Analisadas e concluídas".
 */
export async function markReviewed(
  _previous: AuditState,
  formData: FormData,
): Promise<AuditState> {
  const access = await auditAccess();
  if (!access?.manager) return DENIED;
  const ids = formData.getAll("ids").map(String);
  const done = await markReviewedWith(
    db,
    access.platform ? "all" : [access.tenant.slug],
    ids,
    access.session.user.id,
  );
  revalidatePath("/admin", "layout");
  return {
    status: "saved",
    message:
      done === 1
        ? 'Marcado como lido e ok. Ele foi para "Analisadas e concluídas".'
        : done
          ? `${done} atos marcados como lidos e ok. Eles foram para "Analisadas e concluídas".`
          : "Esses atos já estavam verificados.",
  };
}

export async function addNote(
  _previous: AuditState,
  formData: FormData,
): Promise<AuditState> {
  const access = await auditAccess();
  if (!access?.manager) return DENIED;
  const ok = await addAuditNoteWith(
    db,
    access.platform ? "*" : access.tenant.slug,
    String(formData.get("auditId") ?? ""),
    String(formData.get("body") ?? ""),
    access.session.user.id,
  );
  if (!ok) return { status: "error", message: "Escreva a anotação." };
  revalidatePath("/admin/auditoria");
  return { status: "saved", message: "Anotação salva." };
}

/** The selected entries, by e-mail, as a PDF report. */
export async function emailReport(
  _previous: AuditState,
  formData: FormData,
): Promise<AuditState> {
  const access = await auditAccess();
  if (!access?.manager) return DENIED;
  const to = String(formData.get("email") ?? "").trim();
  if (!z.email().safeParse(to).success) {
    return { status: "error", message: "Informe um e-mail válido." };
  }
  const ids = formData.getAll("ids").map(String).slice(0, 300);
  if (!ids.length)
    return { status: "error", message: "Marque ao menos um registro." };
  const entries = await listAuditWith(db, {
    includePlatform: access.platform,
    tenantSlugs: trailScope(access, String(formData.get("serventia") ?? "")),
    ids,
  });
  const pdf = await renderAuditReportPdf(
    access.tenant,
    entries,
    "Registros selecionados",
  );
  try {
    await emailAuditReport(access.tenant, to, pdf, entries.length);
  } catch (error) {
    console.error("auditoria.email-relatorio", error);
    return { status: "error", message: "Não foi possível enviar o e-mail." };
  }
  return { status: "saved", message: `Relatório enviado para ${to}.` };
}

/**
 * Sends the notification: always on the person's panel (Auditoria, and a
 * warning on every screen until answered), and by e-mail when chosen
 * (decision of 11/11/2026). Acts of several people ticked together make
 * one notification each, with the same text.
 */
export async function createNotification(
  _previous: AuditState,
  formData: FormData,
): Promise<AuditState> {
  const access = await auditAccess();
  if (!access?.manager) return DENIED;
  const tenant = access.tenant;
  const byEmail = formData.get("porEmail") === "on";
  const ids = formData.getAll("ids").map(String);
  const created: string[] = [];
  try {
    // Who gets one: the person chosen, or each author of the ticked acts.
    let targets: { userId: string; ids: string[] }[];
    if (formData.get("modo") === "cada") {
      const entries = await listAuditWith(db, {
        tenantSlugs: [tenant.slug],
        ids,
      });
      const byActor = new Map<string, string[]>();
      for (const entry of entries) {
        if (!entry.actorId || entry.actorId === access.session.user.id) {
          continue;
        }
        byActor.set(entry.actorId, [
          ...(byActor.get(entry.actorId) ?? []),
          entry.id,
        ]);
      }
      targets = [...byActor].map(([userId, own]) => ({ userId, ids: own }));
      if (!targets.length) {
        return {
          status: "error",
          message: "Nenhum dos atos marcados é de outra pessoa da serventia.",
        };
      }
    } else {
      targets = [{ userId: String(formData.get("pessoa") ?? ""), ids }];
    }
    const files = formData
      .getAll("provas")
      .filter((f): f is File => f instanceof File && f.size > 0);
    const stored = files.length
      ? await storeAttachments(files, {
          tenantSlug: tenant.slug,
          name: String(formData.get("provasName") ?? "") || "Prova",
        })
      : [];
    for (const target of targets) {
      const one = await createNotificationWith(
        db,
        tenant.slug,
        {
          targetUserId: target.userId,
          subject: String(formData.get("assunto") ?? ""),
          facts: String(formData.get("fatos") ?? ""),
          legalBasis: String(formData.get("fundamentacao") ?? ""),
          auditIds: target.ids,
          files: stored,
        },
        access.session.user.id,
      );
      created.push(one.id);
    }
  } catch (error) {
    if (
      error instanceof NotificationError ||
      error instanceof AttachmentError
    ) {
      return { status: "error", message: error.message };
    }
    console.error("auditoria.notificar", error);
    return {
      status: "error",
      message: "Não foi possível criar a notificação.",
    };
  }
  if (byEmail) {
    for (const id of created) await sendNotificationEmail(tenant, id);
  }
  revalidatePath("/admin", "layout");
  if (created.length === 1) {
    redirect(`/admin/auditoria/notificacao/${created[0]}?enviada=1`);
  }
  redirect(`/admin/auditoria?notificadas=${created.length}`);
}

/** The holder corrects a note. */
export async function editNote(
  _previous: AuditState,
  formData: FormData,
): Promise<AuditState> {
  const access = await auditAccess();
  if (!access?.manager) return DENIED;
  const ok = await editAuditNoteWith(
    db,
    access.platform ? "*" : access.tenant.slug,
    String(formData.get("noteId") ?? ""),
    String(formData.get("body") ?? ""),
  );
  if (!ok) return { status: "error", message: "Escreva a anotação." };
  revalidatePath("/admin/auditoria");
  return { status: "saved", message: "Anotação corrigida." };
}

/** "Excluir" a note: off the screen, kept in the database. */
export async function removeNote(
  _previous: AuditState,
  formData: FormData,
): Promise<AuditState> {
  const access = await auditAccess();
  if (!access?.manager) return DENIED;
  const ok = await removeAuditNoteWith(
    db,
    access.platform ? "*" : access.tenant.slug,
    String(formData.get("noteId") ?? ""),
    access.session.user.id,
  );
  if (!ok) return { status: "error", message: "Anotação não encontrada." };
  revalidatePath("/admin/auditoria");
  return { status: "saved", message: "Anotação excluída." };
}

/**
 * Archives the ticked entries, or brings them back: the trail's "excluir",
 * which never erases.
 */
export async function archiveEntries(
  _previous: AuditState,
  formData: FormData,
): Promise<AuditState> {
  const access = await auditAccess();
  if (!access?.manager) return DENIED;
  const archived = formData.get("arquivar") !== "0";
  const done = await setArchivedWith(
    db,
    access.platform ? "all" : [access.tenant.slug],
    formData.getAll("ids").map(String),
    access.session.user.id,
    archived,
  );
  revalidatePath("/admin", "layout");
  return {
    status: "saved",
    message: archived
      ? `${done} registro(s) arquivado(s). Eles continuam guardados em "Arquivados".`
      : `${done} registro(s) de volta à lista.`,
  };
}

async function sendNotificationEmail(
  tenant: NonNullable<Awaited<ReturnType<typeof auditAccess>>>["tenant"],
  id: string,
): Promise<boolean> {
  const view = await findNotificationWith(db, tenant.slug, id);
  if (!view) return false;
  const entries = view.auditIds.length
    ? await listAuditWith(db, {
        tenantSlugs: [tenant.slug],
        ids: view.auditIds,
      })
    : [];
  try {
    await emailNotification(
      tenant,
      view,
      await renderNotificationPdf(tenant, view, entries),
    );
    await markNotificationEmailedWith(db, id);
    return true;
  } catch (error) {
    console.error("auditoria.email-notificacao", error);
    return false;
  }
}

export async function resendNotification(
  _previous: AuditState,
  formData: FormData,
): Promise<AuditState> {
  const access = await auditAccess();
  if (!access?.manager) return DENIED;
  const sent = await sendNotificationEmail(
    access.tenant,
    String(formData.get("id") ?? ""),
  );
  return sent
    ? { status: "saved", message: "Notificação reenviada por e-mail." }
    : { status: "error", message: "Não foi possível enviar o e-mail." };
}

export async function closeNotification(
  _previous: AuditState,
  formData: FormData,
): Promise<AuditState> {
  const access = await auditAccess();
  if (!access?.manager) return DENIED;
  const id = String(formData.get("id") ?? "");
  const ok = await closeNotificationWith(
    db,
    access.tenant.slug,
    id,
    String(formData.get("conclusao") ?? ""),
    access.session.user.id,
  );
  if (!ok) return { status: "error", message: "Notificação não encontrada." };
  revalidatePath(`/admin/auditoria/notificacao/${id}`);
  return { status: "saved", message: "Notificação encerrada." };
}

/** The notified person's answer, with files. */
export async function answerNotification(
  _previous: AuditState,
  formData: FormData,
): Promise<AuditState> {
  const access = await auditAccess();
  if (!access) return DENIED;
  const tenant = access.tenant;
  const id = String(formData.get("id") ?? "");
  try {
    const files = formData
      .getAll("anexos")
      .filter((f): f is File => f instanceof File && f.size > 0);
    const stored = files.length
      ? await storeAttachments(files, {
          tenantSlug: tenant.slug,
          name: String(formData.get("anexosName") ?? "") || "Anexo da resposta",
        })
      : [];
    await answerNotificationWith(
      db,
      tenant.slug,
      id,
      access.session.user.id,
      String(formData.get("resposta") ?? ""),
      stored,
    );
  } catch (error) {
    if (
      error instanceof NotificationError ||
      error instanceof AttachmentError
    ) {
      return { status: "error", message: error.message };
    }
    console.error("auditoria.responder", error);
    return { status: "error", message: "Não foi possível enviar a resposta." };
  }
  const view = await findNotificationWith(db, tenant.slug, id);
  if (view) {
    const holders = await db
      .select({ email: user.email })
      .from(user)
      .where(and(eq(user.tenantSlug, tenant.slug), eq(user.role, "admin")));
    await emailAnswerArrived(tenant, view, holders);
  }
  revalidatePath(`/admin/auditoria/notificacao/${id}`);
  return {
    status: "saved",
    message: "Resposta enviada ao Tabelião/Registrador.",
  };
}

/** Signs the notification in the assinador, with the holder's certificate. */
export async function signNotification(
  _previous: AuditState,
  formData: FormData,
): Promise<AuditState> {
  const access = await auditAccess();
  if (!access?.manager) return DENIED;
  const tenant = access.tenant;
  const id = String(formData.get("id") ?? "");
  const view = await findNotificationWith(db, tenant.slug, id);
  if (!view) return { status: "error", message: "Notificação não encontrada." };
  const entries = view.auditIds.length
    ? await listAuditWith(db, {
        includePlatform: access.platform,
        tenantSlugs: [tenant.slug],
        ids: view.auditIds,
      })
    : [];
  const origin = await requestOrigin();
  try {
    const pdf = await renderNotificationPdf(tenant, view, entries);
    const signed = await signNewDocumentWith(
      db,
      tenant.slug,
      {
        certificateId: String(formData.get("certificateId") ?? ""),
        password: String(formData.get("password") ?? ""),
        pdf,
        title: `Notificação de auditoria nº ${notificationNumber(view)}`,
        originalName: "notificacao.pdf",
        verifyUrl: (code) => verifyUrlFor(tenant, origin, code),
        location: `${tenant.location.city}/${tenant.location.state}`,
        officeName: officialName(tenant),
      },
      access.session.user.id,
    );
    await setNotificationSignedWith(db, tenant.slug, id, signed.id);
  } catch (error) {
    if (
      error instanceof SigningError ||
      error instanceof CertificatePasswordError
    ) {
      return { status: "error", message: error.message };
    }
    console.error("auditoria.assinar", error);
    return { status: "error", message: "Não foi possível assinar agora." };
  }
  revalidatePath(`/admin/auditoria/notificacao/${id}`);
  return { status: "saved", message: "Notificação assinada digitalmente." };
}
