import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { colleagues, getConversation, listMessages } from "@/lib/chat.ts";
import { findById } from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { ConversationConsole } from "./_components/conversation-console.tsx";

export const metadata = { title: "Atendimento online" };

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "chat.manage")) notFound();

  const { id } = await params;
  const tenant = await getTenant();
  const conversation = await getConversation(tenant.slug, id);
  if (!conversation) notFound();

  const [messages, colleagueList, matchedRequest] = await Promise.all([
    listMessages(tenant.slug, id, { forCitizen: false }),
    colleagues(tenant.slug),
    conversation.matchedRequestId
      ? findById(tenant.slug, conversation.matchedRequestId)
      : Promise.resolve(undefined),
  ]);

  return (
    <>
      <AdminPageHeader title="Atendimento online" />
      <main className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-admin-border bg-admin-card px-5.5 py-3.5">
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-bold text-admin-text">
              {conversation.citizenName}
            </span>
            <span className="block text-[11.5px] text-admin-faint">
              {conversation.sourcePath
                ? `na página ${conversation.sourcePath}`
                : "origem não registrada"}
              {conversation.informedProtocolNumber &&
                ` · informou o ${conversation.informedProtocolNumber}`}
            </span>
          </span>
          {matchedRequest && (
            <Link
              href={`/admin/pedidos/${encodeURIComponent(matchedRequest.protocolNumber)}`}
              className="rounded-lg border border-admin-input-border px-3.5 py-1.5 text-[12px] font-bold text-admin-muted"
            >
              Abrir {matchedRequest.protocolNumber}
            </Link>
          )}
        </div>

        <ConversationConsole
          conversationId={id}
          initialMessages={messages.map((message) => ({
            id: message.id,
            authorType: message.authorType as
              | "citizen"
              | "staff"
              | "system"
              | "note",
            authorUserId: message.authorUserId,
            body: message.body,
            attachment: message.attachmentPath
              ? { displayName: message.attachmentDisplayName }
              : null,
            createdAt: message.createdAt.toISOString(),
          }))}
          initialStatus={conversation.status}
          colleagues={colleagueList}
          currentUserId={session.user.id}
          matchedRequestId={conversation.matchedRequestId}
        />
      </main>
    </>
  );
}
