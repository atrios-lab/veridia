import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { DPO_COPY, describeMasked } from "@/core/dpo/copy.ts";
import { KNOWLEDGE_BASE_UPDATED_AT } from "@/core/dpo/knowledge/index.ts";
import { effectiveLimit, usageMonth } from "@/core/dpo/quota.ts";
import { formatDate } from "@/core/scheduling/calendar.ts";
import { db } from "@/db/index.ts";
import { type SourceView, sourceView } from "@/lib/dpo/assistant.ts";
import { dpoBlocked } from "@/lib/dpo/models.ts";
import {
  getOwnConversationWith,
  listMessagesWith,
  monthlyLimitWith,
  monthUsageWith,
} from "@/lib/dpo/store.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import { buttonVariants } from "../../_ui/button.tsx";
import { type ChatMessage, DpoChat } from "./_components/dpo-chat.tsx";

export const metadata = { title: "Assistente do DPO" };

export default async function DpoAssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "dpo.assist", session.user.permissions)
  )
    notFound();
  const tenant = await getTenant();
  const { c } = await searchParams;

  let conversationId: string | null = null;
  let initialMessages: ChatMessage[] = [];
  if (c) {
    // Only the person's own conversation: anyone else's answers 404.
    const conversation = await getOwnConversationWith(db, {
      tenantSlug: tenant.slug,
      userId: session.user.id,
      conversationId: c,
    });
    if (!conversation) notFound();
    conversationId = conversation.id;
    initialMessages = (await listMessagesWith(db, conversation.id)).map(
      (m): ChatMessage => {
        if (m.role === "user") {
          return {
            role: "user",
            content: m.content,
            maskedNotice: describeMasked(m.maskedCounts),
          };
        }
        if (m.role === "refusal")
          return { role: "refusal", content: m.content };
        const sources = m.sources
          .map(sourceView)
          .filter((s): s is SourceView => s !== null);
        return {
          role: "assistant",
          content: m.content,
          sources,
          noSource: sources.length === 0 && conversation.kind === "chat",
        };
      },
    );
  }

  const month = usageMonth(new Date());
  const [usage, configuredLimit, blockedReason] = await Promise.all([
    monthUsageWith(db, tenant.slug, month),
    monthlyLimitWith(db, tenant.slug),
    dpoBlocked(tenant.slug),
  ]);

  return (
    <>
      <AdminPageHeader
        maxWidth={820}
        title="Assistente do DPO"
        description="Dúvidas de proteção de dados respondidas com base nas normas citadas."
        actions={
          conversationId ? (
            <Link
              href="/admin/dpo"
              className={buttonVariants({ variant: "outline" })}
            >
              Nova conversa
            </Link>
          ) : null
        }
      />
      <main className="flex max-w-[820px] flex-col gap-4 px-4 pt-6 pb-8 md:px-8">
        <section className="rounded-xl border bg-card p-4 text-xs leading-relaxed text-muted-foreground shadow-xs">
          <p>{DPO_COPY.notAdvice}</p>
          <p className="mt-1">{DPO_COPY.oversightNotice}</p>
          <p className="mt-1">
            Base de normas atualizada em {formatDate(KNOWLEDGE_BASE_UPDATED_AT)}
            : LGPD, Provimento CNJ nº 213/2026, Código Nacional de Normas,
            resoluções da ANPD e Corregedoria do RN.
          </p>
        </section>
        <DpoChat
          key={conversationId ?? "nova"}
          initialConversationId={conversationId}
          initialMessages={initialMessages}
          blockedReason={blockedReason}
          usage={{
            answered: usage.answered,
            limit: effectiveLimit(configuredLimit),
          }}
        />
      </main>
    </>
  );
}
