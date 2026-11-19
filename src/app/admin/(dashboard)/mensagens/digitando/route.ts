import { db } from "@/db/index.ts";
import { setTypingWith } from "@/lib/messages.ts";
import { messengerAccess } from "../access.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Digitando…" (decision of 19/11/2026): the screen posts here every few
 * seconds while keys are pressed, `{ conversationId }`, and `null` when the
 * person stopped. A plain route, not a server action: actions from one page
 * run one at a time, and a ping must never hold a message back.
 */
export async function POST(request: Request): Promise<Response> {
  const access = await messengerAccess();
  if (!access || access.off || access.lunch || access.platform) {
    return new Response(null, { status: 204 });
  }
  let conversationId: string | null = null;
  try {
    const body = (await request.json()) as { conversationId?: unknown };
    conversationId =
      typeof body.conversationId === "string" ? body.conversationId : null;
  } catch {
    // An empty or odd body says "stopped".
  }
  await setTypingWith(
    db,
    access.tenant.slug,
    access.session.user.id,
    conversationId,
  );
  return new Response(null, { status: 204 });
}
