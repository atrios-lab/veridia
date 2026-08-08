import { cookies } from "next/headers";
import { can } from "@/core/auth/roles.ts";
import { needsInactivityWarning } from "@/core/chat/inactivity.ts";
import { messageBodySchema } from "@/core/chat/message.ts";
import {
  attendantSummary,
  CHAT_TOKEN_COOKIE,
  type ChatConversation,
  type ChatMessage,
  closeConversation,
  getConversation,
  getConversationForCitizen,
  listMessages,
  queuePosition,
  sendMessage,
  submitRating,
} from "@/lib/chat.ts";
import { isRateLimited } from "@/lib/rate-limit.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AttachmentError, storeAttachments } from "@/lib/uploads.ts";

export const runtime = "nodejs";

/**
 * Resolves who is asking and which conversation they may reach: an
 * attendant with `chat.manage` may open any conversation of their office; a
 * citizen may only reach the one their cookie's token actually opens, and
 * only when it matches the id in the URL — a browser tab open to someone
 * else's conversation link gets nothing back.
 *
 * The citizen cookie is checked first. Both the widget and the console hit
 * this same route, and the public site and `/admin` share a host, so a
 * browser that is *also* signed in as staff (an attendant testing their own
 * widget, or just a developer logged into both at once) still carries the
 * admin session cookie on the widget's requests. Checking the citizen
 * cookie first — and only for *this* conversation — is what keeps that from
 * being misread as the attendant talking to themselves: a leftover staff
 * session never wins over a token that genuinely opens this conversation.
 */
async function authorize(conversationId: string): Promise<
  | {
      ok: true;
      forCitizen: boolean;
      actorUserId?: string;
      conversation: ChatConversation;
    }
  | { ok: false }
> {
  const tenant = await getTenant();

  const cookieStore = await cookies();
  const token = cookieStore.get(CHAT_TOKEN_COOKIE)?.value;
  if (token) {
    const conversation = await getConversationForCitizen(tenant.slug, token);
    if (conversation && conversation.id === conversationId) {
      return { ok: true, forCitizen: true, conversation };
    }
  }

  const session = await getSession();
  if (session && can(session.user.role ?? "", "chat.manage")) {
    const conversation = await getConversation(tenant.slug, conversationId);
    if (!conversation) return { ok: false };
    return {
      ok: true,
      forCitizen: false,
      actorUserId: session.user.id,
      conversation,
    };
  }

  return { ok: false };
}

function serializeMessage(message: ChatMessage) {
  return {
    id: message.id,
    authorType: message.authorType,
    body: message.body,
    attachment: message.attachmentPath
      ? {
          displayName: message.attachmentDisplayName,
          mimeType: message.attachmentMimeType,
          sizeBytes: message.attachmentSizeBytes,
        }
      : null,
    createdAt: message.createdAt,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
): Promise<Response> {
  const { conversationId } = await params;
  const auth = await authorize(conversationId);
  if (!auth.ok) return Response.json({ error: "not_found" }, { status: 404 });

  const tenant = await getTenant();
  const after = new URL(request.url).searchParams.get("after");
  const messages = await listMessages(tenant.slug, conversationId, {
    after: after ? new Date(after) : undefined,
    forCitizen: auth.forCitizen,
  });

  const attendant = auth.conversation.assignedUserId
    ? await attendantSummary(auth.conversation.assignedUserId)
    : undefined;

  return Response.json({
    conversation: {
      id: auth.conversation.id,
      status: auth.conversation.status,
      closedReason: auth.conversation.closedReason,
      subject: auth.conversation.subject,
      citizenName: auth.forCitizen ? undefined : auth.conversation.citizenName,
      citizenContact: auth.forCitizen
        ? undefined
        : auth.conversation.citizenContact,
      sourcePath: auth.conversation.sourcePath,
      informedProtocolNumber: auth.conversation.informedProtocolNumber,
      matchedRequestId: auth.conversation.matchedRequestId,
      attendantName: attendant?.name,
      attendantSector: attendant?.sector,
      queuePosition:
        auth.conversation.status === "waiting"
          ? await queuePosition(tenant.slug, conversationId)
          : undefined,
      needsInactivityWarning: needsInactivityWarning(
        {
          status: auth.conversation.status as "waiting" | "active" | "closed",
          lastActivityAt: auth.conversation.lastActivityAt,
        },
        new Date(),
      ),
    },
    messages: messages.map(serializeMessage),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
): Promise<Response> {
  if (await isRateLimited(request.headers)) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  const { conversationId } = await params;
  const auth = await authorize(conversationId);
  if (!auth.ok) return Response.json({ error: "not_found" }, { status: 404 });

  const tenant = await getTenant();
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "message");

  // Rating a conversation happens after it is already closed — by the
  // citizen giving up, by staff, or by inactivity — so it is handled before
  // the "closed conversations refuse writes" guard below applies to it.
  if (intent === "rate") {
    if (auth.conversation.status !== "closed" || !auth.forCitizen) {
      return Response.json({ error: "invalid" }, { status: 400 });
    }
    const rating = Number(form.get("rating"));
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return Response.json({ error: "invalid" }, { status: 400 });
    }
    const comment = form.get("ratingComment");
    await submitRating(
      tenant.slug,
      conversationId,
      rating,
      typeof comment === "string" && comment.trim()
        ? comment.trim()
        : undefined,
      form.get("wantsTranscriptEmail") === "on",
    );
    return Response.json({ ok: true });
  }

  if (auth.conversation.status === "closed") {
    return Response.json({ error: "closed" }, { status: 409 });
  }

  // "Desistir da espera" and "Encerrar conversa" on the citizen's side: the
  // conversation ends with no one assigned, or with whoever was already
  // handling it — closeConversation does not care which, it only needs to
  // know it was the citizen who ended it.
  if (intent === "close") {
    if (!auth.forCitizen) {
      return Response.json({ error: "invalid" }, { status: 400 });
    }
    await closeConversation(tenant.slug, conversationId, { kind: "citizen" });
    return Response.json({ ok: true });
  }

  const rawBody = String(form.get("body") ?? "");
  const file = form.get("attachment");

  try {
    let attachment:
      | Awaited<ReturnType<typeof storeAttachments>>[number]
      | undefined;
    if (file instanceof File && file.size > 0) {
      // No `kind` override: same positional "anexo-1" label the citizen
      // wizard already uses (src/app/(public)/solicitar/actions.ts) — the
      // stored file name is never the browser-supplied one either way.
      const stored = await storeAttachments([file]);
      attachment = stored[0];
    }

    if (!attachment) {
      const parsed = messageBodySchema.safeParse(rawBody);
      if (!parsed.success) {
        return Response.json(
          { error: "invalid", message: parsed.error.issues[0]?.message },
          { status: 400 },
        );
      }
      await sendMessage(
        tenant.slug,
        conversationId,
        auth.forCitizen ? "citizen" : "staff",
        parsed.data,
        { actorUserId: auth.actorUserId },
      );
    } else {
      await sendMessage(
        tenant.slug,
        conversationId,
        auth.forCitizen ? "citizen" : "staff",
        "",
        { actorUserId: auth.actorUserId, attachment },
      );
    }
  } catch (error) {
    if (error instanceof AttachmentError) {
      return Response.json(
        { error: "invalid", message: error.message },
        {
          status: 400,
        },
      );
    }
    console.error("chat.send-message", error);
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
