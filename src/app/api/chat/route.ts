import { cookies } from "next/headers";
import { prechatSchema } from "@/core/chat/conversation.ts";
import { isWithinChatHours } from "@/core/chat/hours.ts";
import { looksLikeBot } from "@/core/request/form.ts";
import {
  CHAT_TOKEN_COOKIE,
  CHAT_TOKEN_MAX_AGE_SECONDS,
  isChatEnabled,
  startConversation,
} from "@/lib/chat.ts";
import { isRateLimited } from "@/lib/rate-limit.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * Starts a conversation from the widget's pre-chat. Mirrors the honeypot and
 * rate-limit discipline the other public forms already use — see
 * src/app/(public)/solicitar/actions.ts.
 */
export async function POST(request: Request): Promise<Response> {
  const tenant = await getTenant();
  const form = await request.formData();

  if (looksLikeBot(form.get("website"))) {
    // The tela advances as if the conversation was created, but nothing is
    // written and no cookie is set — see support-chat spec, "Campo-armadilha
    // preenchido".
    return Response.json({ id: null, token: null });
  }

  if (await isRateLimited(request.headers)) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  const enabled = await isChatEnabled(tenant.slug);
  if (!enabled || !isWithinChatHours(tenant, new Date())) {
    return Response.json({ error: "closed" }, { status: 409 });
  }

  const parsed = prechatSchema.safeParse({
    name: form.get("name"),
    contact: form.get("contact"),
    subject: form.get("subject"),
    informedProtocolNumber: form.get("informedProtocolNumber") ?? undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      fieldErrors[field] ??= issue.message;
    }
    return Response.json({ error: "invalid", fieldErrors }, { status: 400 });
  }

  const sourcePath = form.get("sourcePath");
  const { id, token, matchedProtocolNumber } = await startConversation(
    tenant.slug,
    parsed.data,
    typeof sourcePath === "string" ? sourcePath : undefined,
  );

  const cookieStore = await cookies();
  cookieStore.set(CHAT_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CHAT_TOKEN_MAX_AGE_SECONDS,
  });

  return Response.json({
    id,
    matchedProtocolNumber: matchedProtocolNumber ?? null,
  });
}
