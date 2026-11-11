"use server";

import { revalidatePath } from "next/cache";

import { can } from "@/core/auth/roles.ts";
import {
  acceptedType,
  FILE_TYPES,
  isAudio,
  isImage,
  MAX_FILE_BYTES,
} from "@/core/messages/rules.ts";
import { db } from "@/db/index.ts";
import {
  type Contact,
  clearConversationWith,
  clearedAtWith,
  decideLunchWith,
  deleteMessageWith,
  editMessageWith,
  getProfileWith,
  type Incoming,
  inboxWith,
  listContactsWith,
  listMessagesWith,
  MessageError,
  type MessageView,
  markReadWith,
  openDirectWith,
  requestLunchWith,
  sendMessageWith,
  setChatDisabledWith,
  touchPresenceWith,
  updateProfileWith,
} from "@/lib/messages.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { storeMessengerFile } from "@/lib/uploads.ts";

async function messengerAccess() {
  const session = await getSession();
  const role = session?.user.role ?? "";
  if (!session || !can(role, "desk.access", session.user.permissions)) {
    return null;
  }
  const tenant = await getTenant();
  const profile = await getProfileWith(db, tenant.slug, session.user.id);
  return {
    session,
    tenant,
    /** The holder turned this person's messenger off. */
    off: Boolean(profile?.chatDisabled),
    // The Átrios account reads every conversation and is seen by no one:
    // it never writes, never shows online (decision of 11/11/2026).
    platform: role === "superadmin",
    oversight:
      role === "superadmin" ||
      can(role, "audit.manage", session.user.permissions),
  };
}

export type Result<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; message: string };

const DENIED = { ok: false as const, message: "Sem permissão." };
const CHAT_OFF = {
  ok: false as const,
  message:
    "Suas mensagens internas foram desativadas pelo Tabelião/Registrador.",
};
const PLATFORM_READS_ONLY = {
  ok: false as const,
  message:
    "A conta da Átrios só acompanha as conversas, em Todas as conversas.",
};

function failure(error: unknown, where: string) {
  if (error instanceof MessageError) {
    return { ok: false as const, message: error.message };
  }
  console.error(where, error);
  return {
    ok: false as const,
    message: "Não foi possível agora. Tente de novo.",
  };
}

/** The one conversation with that person, created on first use. */
export async function openConversation(
  otherId: string,
): Promise<Result<string>> {
  const access = await messengerAccess();
  if (!access) return DENIED;
  if (access.platform) return PLATFORM_READS_ONLY;
  if (access.off) return CHAT_OFF;
  try {
    const id = await openDirectWith(
      db,
      access.tenant.slug,
      access.session.user.id,
      otherId,
    );
    return { ok: true, data: id };
  } catch (error) {
    return failure(error, "mensagens.abrir");
  }
}

export async function sendText(
  conversationId: string,
  body: string,
): Promise<Result> {
  const access = await messengerAccess();
  if (!access) return DENIED;
  if (access.platform) return PLATFORM_READS_ONLY;
  if (access.off) return CHAT_OFF;
  try {
    await sendMessageWith(
      db,
      access.tenant.slug,
      conversationId,
      access.session.user.id,
      { kind: "texto", body },
    );
    return { ok: true };
  } catch (error) {
    return failure(error, "mensagens.texto");
  }
}

export async function sendNudge(conversationId: string): Promise<Result> {
  const access = await messengerAccess();
  if (!access) return DENIED;
  if (access.platform) return PLATFORM_READS_ONLY;
  if (access.off) return CHAT_OFF;
  try {
    await sendMessageWith(
      db,
      access.tenant.slug,
      conversationId,
      access.session.user.id,
      { kind: "chamar" },
    );
    return { ok: true };
  } catch (error) {
    return failure(error, "mensagens.chamar");
  }
}

/** A file or a voice note: one per request, under 4 MB. */
export async function sendFile(formData: FormData): Promise<Result> {
  const access = await messengerAccess();
  if (!access) return DENIED;
  if (access.platform) return PLATFORM_READS_ONLY;
  if (access.off) return CHAT_OFF;
  const conversationId = String(formData.get("conversationId") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Escolha o arquivo." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, message: "O arquivo passa de 4 MB." };
  }
  const type = acceptedType(file.name, file.type);
  if (!type) {
    return {
      ok: false,
      message:
        "Tipo de arquivo não aceito. Envie PDF, imagem, documento do Office, texto, ZIP ou áudio.",
    };
  }
  try {
    const path = await storeMessengerFile(
      access.tenant.slug,
      Buffer.from(await file.arrayBuffer()),
      type,
      FILE_TYPES[type],
    );
    await sendMessageWith(
      db,
      access.tenant.slug,
      conversationId,
      access.session.user.id,
      {
        kind:
          isAudio(type) && formData.get("audio") === "1" ? "audio" : "arquivo",
        file: {
          path,
          name: file.name || `arquivo.${FILE_TYPES[type]}`,
          mimeType: type,
          sizeBytes: file.size,
        },
      },
    );
    return { ok: true };
  } catch (error) {
    return failure(error, "mensagens.arquivo");
  }
}

export interface SerializedMessage
  extends Omit<MessageView, "createdAt" | "editedAt"> {
  createdAt: string;
  editedAt: string | null;
}

export interface SerializedContact extends Omit<Contact, "lastMessageAt"> {
  lastMessageAt: string | null;
}

/**
 * The messenger screen's heartbeat: marks the person online, brings the
 * contact list (presence, unread) and the open conversation's new
 * messages, and marks that conversation as read.
 */
export async function pollMessenger(
  conversationId: string | null,
  afterIso: string | null,
): Promise<
  Result<{
    contacts: SerializedContact[];
    messages: SerializedMessage[];
    /** Where the next poll starts: edits and deletions since then come too. */
    now: string;
    /** "Limpar conversa", by either member: nothing up to here shows. */
    clearedAt: string | null;
  }>
> {
  const access = await messengerAccess();
  if (!access) return DENIED;
  const now = new Date();
  const viewer = { id: access.session.user.id, oversight: access.oversight };
  if (!access.platform) {
    await touchPresenceWith(db, access.tenant.slug, viewer.id, now);
  }
  const after = afterIso ? new Date(afterIso) : undefined;
  const messages = conversationId
    ? ((await listMessagesWith(db, access.tenant.slug, conversationId, viewer, {
        after: after && !Number.isNaN(after.getTime()) ? after : undefined,
      })) ?? [])
    : [];
  if (conversationId) await markReadWith(db, conversationId, viewer.id, now);
  const clearedAt = conversationId
    ? await clearedAtWith(db, conversationId, viewer.id)
    : null;
  const contacts = await listContactsWith(
    db,
    access.tenant.slug,
    viewer.id,
    now,
  );
  return {
    ok: true,
    data: {
      contacts: contacts.map((c) => ({
        ...c,
        lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
      })),
      messages: messages.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
        editedAt: m.editedAt?.toISOString() ?? null,
      })),
      now: now.toISOString(),
      clearedAt: clearedAt?.toISOString() ?? null,
    },
  };
}

/** For the watcher on every screen: what arrived since the last look. */
export async function pollInbox(sinceIso: string): Promise<
  Result<{
    incoming: (Omit<Incoming, "createdAt"> & { createdAt: string })[];
    latest: (Omit<Incoming, "createdAt"> & { createdAt: string }) | null;
    unread: number;
    now: string;
  }>
> {
  const access = await messengerAccess();
  if (!access) return DENIED;
  const now = new Date();
  if (!access.platform) {
    await touchPresenceWith(
      db,
      access.tenant.slug,
      access.session.user.id,
      now,
    );
  }
  const since = new Date(sinceIso);
  const { incoming, unread, latest } = await inboxWith(
    db,
    access.session.user.id,
    Number.isNaN(since.getTime()) ? now : since,
  );
  return {
    ok: true,
    data: {
      unread,
      latest: latest
        ? { ...latest, createdAt: latest.createdAt.toISOString() }
        : null,
      now: now.toISOString(),
      incoming: incoming.map((i) => ({
        ...i,
        createdAt: i.createdAt.toISOString(),
      })),
    },
  };
}

const PHOTO_BYTES = 2 * 1024 * 1024;

/** Status, the line under the name, colour, sound and photo. */
export async function saveProfile(formData: FormData): Promise<Result> {
  const access = await messengerAccess();
  if (!access) return DENIED;
  if (access.platform) return PLATFORM_READS_ONLY;
  let photoPath: string | undefined;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const type = acceptedType(photo.name, photo.type);
    if (!type || !isImage(type)) {
      return { ok: false, message: "A foto precisa ser JPG, PNG ou WEBP." };
    }
    if (photo.size > PHOTO_BYTES) {
      return { ok: false, message: "A foto passa de 2 MB." };
    }
    photoPath = await storeMessengerFile(
      access.tenant.slug,
      Buffer.from(await photo.arrayBuffer()),
      type,
      FILE_TYPES[type],
      "fotos",
    );
  }
  await updateProfileWith(db, access.tenant.slug, access.session.user.id, {
    status: String(formData.get("status") ?? "") || undefined,
    personalMessage:
      formData.get("personalMessage") === null
        ? undefined
        : String(formData.get("personalMessage")),
    color: String(formData.get("color") ?? "") || undefined,
    // An unticked box sends nothing: the hidden field says the box was there.
    sound: formData.get("soundField")
      ? formData.get("sound") === "on"
      : undefined,
    ...(photoPath ? { photoPath } : {}),
  });
  return { ok: true };
}

/**
 * Asks for the daily lunch window (or a change): it waits for the holder,
 * goes to the audit and cannot be asked again until decided.
 */
export async function requestLunch(
  start: string,
  minutes: number,
): Promise<Result> {
  const access = await messengerAccess();
  if (!access) return DENIED;
  if (access.platform) return PLATFORM_READS_ONLY;
  try {
    await requestLunchWith(
      db,
      access.tenant.slug,
      access.session.user.id,
      start,
      minutes,
    );
    return { ok: true };
  } catch (error) {
    return failure(error, "mensagens.almoco");
  }
}

async function holderAccess() {
  const access = await messengerAccess();
  if (!access) return null;
  const role = access.session.user.role ?? "";
  return can(role, "audit.manage", access.session.user.permissions)
    ? access
    : null;
}

/** The holder approves, or not, the lunch window asked for. */
export async function decideLunch(
  userId: string,
  approve: boolean,
): Promise<Result> {
  const access = await holderAccess();
  if (!access) return DENIED;
  const done = await decideLunchWith(
    db,
    access.tenant.slug,
    userId,
    approve,
    access.session.user.id,
  );
  revalidatePath("/admin/mensagens/supervisao");
  return done
    ? { ok: true }
    : { ok: false, message: "Não há pedido de almoço desta pessoa." };
}

/** The holder turns one person's messenger off, or back on. */
export async function setChatEnabled(
  userId: string,
  enabled: boolean,
): Promise<Result> {
  const access = await holderAccess();
  if (!access) return DENIED;
  await setChatDisabledWith(
    db,
    access.tenant.slug,
    userId,
    !enabled,
    access.session.user.id,
  );
  revalidatePath("/admin/mensagens/supervisao");
  return { ok: true };
}

/** Its author corrects a text message. */
export async function editMessage(
  messageId: string,
  body: string,
): Promise<Result> {
  const access = await messengerAccess();
  if (!access) return DENIED;
  if (access.platform) return PLATFORM_READS_ONLY;
  if (access.off) return CHAT_OFF;
  try {
    await editMessageWith(
      db,
      access.tenant.slug,
      messageId,
      access.session.user.id,
      body,
    );
    return { ok: true };
  } catch (error) {
    return failure(error, "mensagens.editar");
  }
}

/** Its author deletes a message: gone from the chat, kept for the holder. */
export async function deleteMessage(messageId: string): Promise<Result> {
  const access = await messengerAccess();
  if (!access) return DENIED;
  if (access.platform) return PLATFORM_READS_ONLY;
  try {
    await deleteMessageWith(
      db,
      access.tenant.slug,
      messageId,
      access.session.user.id,
    );
    return { ok: true };
  } catch (error) {
    return failure(error, "mensagens.apagar");
  }
}

/** "Limpar conversa": for this person only. */
export async function clearConversation(
  conversationId: string,
): Promise<Result> {
  const access = await messengerAccess();
  if (!access) return DENIED;
  if (access.platform) return PLATFORM_READS_ONLY;
  try {
    await clearConversationWith(
      db,
      access.tenant.slug,
      conversationId,
      access.session.user.id,
    );
    return { ok: true };
  } catch (error) {
    return failure(error, "mensagens.limpar");
  }
}
