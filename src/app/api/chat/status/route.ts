import { isWithinChatHours } from "@/core/chat/hours.ts";
import { isChatEnabled } from "@/lib/chat.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * Whether the office's chat is switched on and inside attendance hours right
 * now. Polled by the widget on its own, separate from a conversation, so
 * turning the office's chat off removes the floating button within a few
 * seconds — see admin-support-chat spec, "Interruptor 'Disponível para o
 * chat' some o botão na hora".
 */
export async function GET(): Promise<Response> {
  const tenant = await getTenant();
  const enabled = await isChatEnabled(tenant.slug);
  return Response.json({
    enabled,
    withinHours: isWithinChatHours(tenant, new Date()),
  });
}
