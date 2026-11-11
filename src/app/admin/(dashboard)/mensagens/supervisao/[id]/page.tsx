import { notFound } from "next/navigation";
import { BackLink } from "@/app/admin/_components/back-link";
import { can } from "@/core/auth/roles.ts";
import { formatOfficeDateTime } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { findConversationWith, listMessagesWith } from "@/lib/messages.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";

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
      <AdminPageHeader title="Mensagens internas" />
      <main className="flex max-w-[900px] flex-col gap-4 px-[30px] py-7 max-md:px-4">
        <BackLink
          href="/admin/mensagens/supervisao"
          label="Todas as conversas"
        />
        <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
            {conversation.members.map((m) => m.name).join(" e ")}
          </h2>
          <ol className="mt-3 flex flex-col gap-2">
            {messages.map((m) => (
              <li
                key={m.id}
                className={`text-[13px] ${m.deleted ? "rounded-[8px] bg-admin-error-bg/40 px-2 py-1" : ""}`}
              >
                <p className="text-[12px]">
                  <strong className="text-admin-primary">{m.senderName}</strong>{" "}
                  <span className="text-admin-muted">
                    {m.kind === "chamar" ? "chamou a atenção" : "diz"} ·{" "}
                    {formatOfficeDateTime(m.createdAt)}
                  </span>
                  {m.deleted && (
                    <span className="ml-2 rounded-full bg-admin-error-bg px-2 py-0.5 text-[11px] font-semibold text-admin-error-text">
                      Apagada pelo autor
                    </span>
                  )}
                  {m.editedAt && (
                    <span className="ml-2 rounded-full bg-admin-warning-bg px-2 py-0.5 text-[11px] font-semibold text-admin-warning-text">
                      Editada em {formatOfficeDateTime(m.editedAt)}
                    </span>
                  )}
                </p>
                {m.editedAt && m.originalBody && m.originalBody !== m.body && (
                  <p className="pl-3 text-[12px] text-admin-muted [overflow-wrap:anywhere]">
                    <strong>Texto original:</strong> {m.originalBody}
                  </p>
                )}
                {m.kind === "texto" && (
                  <p className="whitespace-pre-wrap pl-3 text-admin-text [overflow-wrap:anywhere]">
                    {m.body}
                  </p>
                )}
                {(m.kind === "arquivo" || m.kind === "audio") && (
                  <a
                    href={`/admin/mensagens/arquivo/${m.id}`}
                    target="_blank"
                    rel="noopener"
                    className="pl-3 font-semibold text-admin-primary underline [overflow-wrap:anywhere]"
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
