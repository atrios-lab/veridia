"use server";

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
  type Incoming,
  inboxWith,
  listContactsWith,
  listMessagesWith,
  MessageError,
  type MessageView,
  markReadWith,
  openDirectWith,
  sendMessageWith,
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
  return {
    session,
    tenant,
    oversight:
      role === "superadmin" ||
      can(role, "audit.manage", session.user.permissions),
  };
}

export type Result<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; message: string };

const DENIED = { ok: false as const, message: "Sem permissão." };

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

export interface SerializedMessage extends Omit<MessageView, "createdAt"> {
  createdAt: string;
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
  Result<{ contacts: SerializedContact[]; messages: SerializedMessage[] }>
> {
  const access = await messengerAccess();
  if (!access) return DENIED;
  const now = new Date();
  const viewer = { id: access.session.user.id, oversight: access.oversight };
  await touchPresenceWith(db, access.tenant.slug, viewer.id, now);
  const after = afterIso ? new Date(afterIso) : undefined;
  const messages = conversationId
    ? ((await listMessagesWith(db, access.tenant.slug, conversationId, viewer, {
        after: after && !Number.isNaN(after.getTime()) ? after : undefined,
      })) ?? [])
    : [];
  if (conversationId) await markReadWith(db, conversationId, viewer.id, now);
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
      })),
    },
  };
}

/** For the watcher on every screen: what arrived since the last look. */
export async function pollInbox(sinceIso: string): Promise<
  Result<{
    incoming: (Omit<Incoming, "createdAt"> & { createdAt: string })[];
    unread: number;
    now: string;
  }>
> {
  const access = await messengerAccess();
  if (!access) return DENIED;
  const now = new Date();
  await touchPresenceWith(db, access.tenant.slug, access.session.user.id, now);
  const since = new Date(sinceIso);
  const { incoming, unread } = await inboxWith(
    db,
    access.session.user.id,
    Number.isNaN(since.getTime()) ? now : since,
  );
  return {
    ok: true,
    data: {
      unread,
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
