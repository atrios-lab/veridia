import "server-only";
import { can } from "@/core/auth/roles.ts";
import { buildDpoDocument, documentPart } from "@/core/dpo/chat-document.ts";
import { db } from "@/db/index.ts";
import { ownAssistantMessageWith } from "@/lib/dpo/store.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, today } from "@/lib/tenant.ts";

/**
 * The document drafted in one of the person's own conversations with the
 * Assistente do DPO: the stored answer, the part after "---", as a
 * document under the office's letterhead.
 */
export async function chatDocumentFor(id: string) {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "dpo.assist", session.user.permissions)
  ) {
    return { status: 403 as const };
  }
  const tenant = await getTenant();
  const message = await ownAssistantMessageWith(db, {
    tenantSlug: tenant.slug,
    userId: session.user.id,
    messageId: id,
  });
  if (!message) return { status: 404 as const };
  const text = documentPart(message.content);
  if (!text) return { status: 404 as const };
  return {
    status: 200 as const,
    tenant,
    document: buildDpoDocument(tenant, { text, issuedOn: today() }),
  };
}
