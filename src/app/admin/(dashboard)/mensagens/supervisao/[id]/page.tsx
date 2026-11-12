import { notFound } from "next/navigation";
import { BackLink } from "@/app/admin/_components/back-link";
import { can } from "@/core/auth/roles.ts";
import { formatOfficeDateTime } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { findConversationWith, listMessagesWith } from "@/lib/messages.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { Badge } from "../../../../_ui/badge.tsx";
import { cn } from "../../../../_ui/cn.ts";

export const metadata = { title: "Conversa" };

export default async function OversightConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  const role = session?.user.role ?? "";
  const oversight =
    role === "superadmin" ||
    can(role, "audit.manage", session?.user.permissions);
  if (!session || !oversight) notFound();
  const tenant = await getTenant();
  const { id } = await params;
  const viewer = { id: session.user.id, oversight: true };
  const [conversation, messages] = await Promise.all([
    findConversationWith(db, tenant.slug, id, viewer),
    listMessagesWith(db, tenant.slug, id, viewer, { limit: 500, full: true }),
  ]);
  if (!conversation || !messages) notFound();
  return (
    <>
      <AdminPageHeader maxWidth={900} title="Mensagens internas" />
      <main className="flex max-w-[900px] flex-col gap-6 px-4 pt-6 pb-8 md:px-8">
        <BackLink
          href="/admin/mensagens/supervisao"
          label="Todas as conversas"
        />
        <section className="rounded-xl border bg-card p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-foreground">
            {conversation.members.map((m) => m.name).join(" e ")}
          </h2>
          <ol className="mt-3 flex flex-col gap-2">
            {messages.map((m) => (
              <li
                key={m.id}
                className={cn(
                  "text-sm",
                  m.deleted && "rounded-lg bg-destructive-soft px-2 py-1",
                )}
              >
                <p className="text-xs">
                  <strong className="font-semibold text-foreground">
                    {m.senderName}
                  </strong>{" "}
                  <span className="text-muted-foreground">
                    {m.kind === "chamar" ? "chamou a atenção" : "diz"} ·{" "}
                    {formatOfficeDateTime(m.createdAt)}
                  </span>
                  {m.deleted && (
                    <Badge variant="destructive" className="ml-2">
                      Apagada pelo autor
                    </Badge>
                  )}
                  {m.editedAt && (
                    <Badge className="ml-2 bg-warning-soft text-warning-text">
                      Editada em {formatOfficeDateTime(m.editedAt)}
                    </Badge>
                  )}
                </p>
                {m.editedAt && m.originalBody && m.originalBody !== m.body && (
                  <p className="pl-3 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                    <strong>Texto original:</strong> {m.originalBody}
                  </p>
                )}
                {m.kind === "texto" && (
                  <p className="whitespace-pre-wrap pl-3 text-foreground [overflow-wrap:anywhere]">
                    {m.body}
                  </p>
                )}
                {(m.kind === "arquivo" || m.kind === "audio") && (
                  <a
                    href={`/admin/mensagens/arquivo/${m.id}`}
                    target="_blank"
                    rel="noopener"
                    className="pl-3 font-medium text-primary underline underline-offset-4 [overflow-wrap:anywhere]"
                  >
                    {m.kind === "audio" ? "Áudio" : m.fileName}
                  </a>
                )}
              </li>
            ))}
          </ol>
        </section>
      </main>
    </>
  );
}
