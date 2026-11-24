import "server-only";
import { and, asc, eq } from "drizzle-orm";
import {
  CITIZEN_MESSAGE_MAX,
  citizenMayWrite,
} from "@/core/scheduling/conversation.ts";
import { LONG_TEXT_MAX } from "@/core/text-limits.ts";
import { type Database, db } from "@/db/index.ts";
import { appointmentMessages, appointments } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";

/**
 * The exigência and the questions of an appointment (decision of
 * 24/11/2026). The office writes from the panel's detail, the citizen
 * from the consult. Nothing is deleted: an edit keeps the old text in
 * `history`, "apagar" hides, and every act goes to the audit.
 */

export type AppointmentMessage = typeof appointmentMessages.$inferSelect;

export class ConversationError extends Error {}

interface Actor {
  id: string;
  name: string;
}

export async function listAppointmentMessagesWith(
  database: Database,
  tenantSlug: string,
  appointmentId: string,
): Promise<AppointmentMessage[]> {
  return database
    .select()
    .from(appointmentMessages)
    .where(
      and(
        eq(appointmentMessages.tenantSlug, tenantSlug),
        eq(appointmentMessages.appointmentId, appointmentId),
      ),
    )
    .orderBy(asc(appointmentMessages.createdAt));
}

export function listAppointmentMessages(
  tenantSlug: string,
  appointmentId: string,
): Promise<AppointmentMessage[]> {
  return listAppointmentMessagesWith(db, tenantSlug, appointmentId);
}

async function ownAppointment(
  database: Database,
  tenantSlug: string,
  appointmentId: string,
) {
  const [row] = await database
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantSlug, tenantSlug),
        eq(appointments.id, appointmentId),
      ),
    )
    .limit(1);
  if (!row) throw new ConversationError("Agendamento não encontrado.");
  return row;
}

async function ownMessage(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<AppointmentMessage> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    throw new ConversationError("Mensagem não encontrada.");
  }
  const [row] = await database
    .select()
    .from(appointmentMessages)
    .where(
      and(
        eq(appointmentMessages.tenantSlug, tenantSlug),
        eq(appointmentMessages.id, id),
      ),
    )
    .limit(1);
  if (!row) throw new ConversationError("Mensagem não encontrada.");
  return row;
}

function cleanBody(body: string, max: number): string {
  const text = body.replace(/\r\n?/g, "\n").trim();
  if (text.length < 2) throw new ConversationError("Escreva a mensagem.");
  if (text.length > max) {
    throw new ConversationError(
      `A mensagem passou do limite de ${max} caracteres.`,
    );
  }
  return text;
}

/** An exigência or a question from the office. Opening a question also
 * opens the questions, so the citizen can answer it. */
export async function addOfficeEntryWith(
  database: Database,
  tenantSlug: string,
  appointmentId: string,
  kind: "requirement" | "message",
  rawBody: string,
  actor: Actor,
) {
  const appointment = await ownAppointment(database, tenantSlug, appointmentId);
  const body = cleanBody(rawBody, LONG_TEXT_MAX);
  const existing = await listAppointmentMessagesWith(
    database,
    tenantSlug,
    appointmentId,
  );
  if (kind === "message" && !citizenMayWrite(existing, true)) {
    await database.insert(appointmentMessages).values({
      tenantSlug,
      appointmentId,
      kind: "open",
      authorType: "office",
      authorId: actor.id,
      authorName: actor.name,
    });
  }
  await database.insert(appointmentMessages).values({
    tenantSlug,
    appointmentId,
    kind,
    authorType: "office",
    authorId: actor.id,
    authorName: actor.name,
    body,
  });
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action:
      kind === "requirement"
        ? "appointment.requirement"
        : "appointment.message",
    targetType: "appointment",
    targetId: appointment.id,
  });
  return { appointment, body };
}

/** The office opening or closing the questions for the citizen. */
export async function setQuestionsWith(
  database: Database,
  tenantSlug: string,
  appointmentId: string,
  open: boolean,
  actor: Actor,
): Promise<void> {
  await ownAppointment(database, tenantSlug, appointmentId);
  await database.insert(appointmentMessages).values({
    tenantSlug,
    appointmentId,
    kind: open ? "open" : "close",
    authorType: "office",
    authorId: actor.id,
    authorName: actor.name,
  });
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: open ? "appointment.questions-open" : "appointment.questions-close",
    targetType: "appointment",
    targetId: appointmentId,
  });
}

/** Marks an exigência as met, or open again. */
export async function resolveRequirementWith(
  database: Database,
  tenantSlug: string,
  id: string,
  resolved: boolean,
  actor: Actor,
): Promise<void> {
  const row = await ownMessage(database, tenantSlug, id);
  if (row.kind !== "requirement" || row.hiddenAt) {
    throw new ConversationError("Exigência não encontrada.");
  }
  await database
    .update(appointmentMessages)
    .set({
      resolvedAt: resolved ? new Date() : null,
      resolvedBy: resolved ? actor.id : null,
    })
    .where(eq(appointmentMessages.id, row.id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: resolved
      ? "appointment.requirement-met"
      : "appointment.requirement-reopen",
    targetType: "appointment",
    targetId: row.appointmentId,
  });
}

/** Changes what the office wrote, keeping the old text. */
export async function editOfficeEntryWith(
  database: Database,
  tenantSlug: string,
  id: string,
  rawBody: string,
  actor: Actor,
): Promise<void> {
  const row = await ownMessage(database, tenantSlug, id);
  if (
    row.authorType !== "office" ||
    row.hiddenAt ||
    (row.kind !== "requirement" && row.kind !== "message")
  ) {
    throw new ConversationError(
      "Só dá para alterar o que a serventia escreveu.",
    );
  }
  const body = cleanBody(rawBody, LONG_TEXT_MAX);
  if (body === row.body) return;
  const now = new Date();
  const history = [
    ...((row.history as unknown[]) ?? []),
    {
      body: row.body,
      at: (row.editedAt ?? row.createdAt).toISOString(),
      by: actor.id,
    },
  ];
  await database
    .update(appointmentMessages)
    .set({ body, history, editedAt: now })
    .where(eq(appointmentMessages.id, row.id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "appointment.message-edit",
    targetType: "appointment",
    targetId: row.appointmentId,
  });
}

/** "Apagar": hides the entry for both sides; the row and its text stay. */
export async function hideEntryWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actor: Actor,
): Promise<void> {
  const row = await ownMessage(database, tenantSlug, id);
  if (row.hiddenAt) return;
  await database
    .update(appointmentMessages)
    .set({ hiddenAt: new Date(), hiddenBy: actor.id })
    .where(eq(appointmentMessages.id, row.id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "appointment.message-hide",
    targetType: "appointment",
    targetId: row.appointmentId,
  });
}

/**
 * The citizen's answer, from the consult: only while the office keeps the
 * questions open and the appointment is still ahead.
 */
export async function addCitizenMessageWith(
  database: Database,
  tenantSlug: string,
  appointment: { id: string; citizenName: string },
  appointmentOpen: boolean,
  rawBody: string,
): Promise<void> {
  const existing = await listAppointmentMessagesWith(
    database,
    tenantSlug,
    appointment.id,
  );
  if (!citizenMayWrite(existing, appointmentOpen)) {
    throw new ConversationError(
      "O cartório encerrou as perguntas deste agendamento.",
    );
  }
  const body = cleanBody(rawBody, CITIZEN_MESSAGE_MAX);
  await database.insert(appointmentMessages).values({
    tenantSlug,
    appointmentId: appointment.id,
    kind: "message",
    authorType: "citizen",
    authorName: appointment.citizenName,
    body,
  });
  await recordAuditWith(database, {
    tenantSlug,
    actorId: null,
    action: "appointment.citizen-message",
    targetType: "appointment",
    targetId: appointment.id,
  });
}
