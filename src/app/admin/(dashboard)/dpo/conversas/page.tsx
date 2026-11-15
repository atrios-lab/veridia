import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { DPO_COPY } from "@/core/dpo/copy.ts";
import { formatOfficeDateTime } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { listOwnConversationsWith } from "@/lib/dpo/store.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { buttonVariants } from "../../../_ui/button.tsx";

export const metadata = { title: "Minhas conversas" };

/** The person's own conversations with the assistant, latest first. */
export default async function DpoConversationsPage() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "dpo.assist", session.user.permissions)
  )
    notFound();
  const tenant = await getTenant();
  const conversations = await listOwnConversationsWith(db, {
    tenantSlug: tenant.slug,
    userId: session.user.id,
  });

  return (
    <>
      <AdminPageHeader
        maxWidth={820}
        title="Minhas conversas"
        description="Só você vê esta lista. As conversas são apagadas 12 meses depois da última mensagem."
        actions={
          <Link href="/admin/dpo" className={buttonVariants()}>
            Nova conversa
          </Link>
        }
      />
      <main className="flex max-w-[820px] flex-col gap-3 px-4 pt-6 pb-8 md:px-8">
        {conversations.length === 0 ? (
          <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-xs">
            Nenhuma conversa ainda.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <Link
                  href={`/admin/dpo?c=${conversation.id}`}
                  className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3 shadow-xs transition-colors hover:bg-muted"
                >
                  <span className="text-sm font-medium text-foreground [overflow-wrap:anywhere]">
                    {conversation.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {conversation.kind === "reply-draft"
                      ? "Rascunho de resposta a requerimento LGPD · "
                      : ""}
                    {formatOfficeDateTime(conversation.lastMessageAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          {DPO_COPY.oversightNotice}
        </p>
      </main>
    </>
  );
}
