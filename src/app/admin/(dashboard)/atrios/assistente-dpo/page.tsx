import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { describeMasked } from "@/core/dpo/copy.ts";
import { effectiveLimit, usageMonth } from "@/core/dpo/quota.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import { formatOfficeDateTime } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import {
  getConversationWith,
  listMessagesWith,
  listTenantConversationsWith,
  listTenantOverviewWith,
} from "@/lib/dpo/store.ts";
import { getSession } from "@/lib/session.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { LimitForm } from "./limit-form.tsx";

export const metadata = { title: "Assistente do DPO" };

const ROLE_NAMES: Record<string, string> = {
  admin: "Tabelião/Registrador",
  "substituto-legal": "Substituto legal",
  substituto: "Substituto",
  "escrevente-autorizado": "Escrevente autorizado(a)",
  staff: "Escrevente",
  auxiliar: "Auxiliar",
  contador: "Contador",
  rh: "RH",
  superadmin: "Conta mestre",
};

/**
 * The Átrios master account's view of the DPO assistant: every office's
 * use this month, its ceiling, and its conversations as stored (masked).
 * Reading only: nothing here edits or deletes a message.
 */
export default async function DpoOversightPage({
  searchParams,
}: {
  searchParams: Promise<{ serventia?: string; conversa?: string }>;
}) {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "dpo.oversee", session.user.permissions)
  )
    notFound();
  const { serventia, conversa } = await searchParams;
  const month = usageMonth(new Date());
  const overview = await listTenantOverviewWith(db, month);
  const tenants = Object.values(TENANTS).sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );
  const nameOf = (slug: string) => TENANTS[slug]?.name ?? slug;

  if (conversa) {
    const conversation = await getConversationWith(db, conversa);
    if (!conversation) notFound();
    const messages = await listMessagesWith(db, conversation.id);
    return (
      <>
        <AdminPageHeader
          maxWidth={900}
          title={conversation.title}
          back={{
            href: `/admin/atrios/assistente-dpo?serventia=${conversation.tenantSlug}`,
            label: nameOf(conversation.tenantSlug),
          }}
          description={`${ROLE_NAMES[conversation.userRole] ?? conversation.userRole} · ${formatOfficeDateTime(conversation.createdAt)}`}
        />
        <main className="flex max-w-[900px] flex-col gap-3 px-4 pt-6 pb-8 md:px-8">
          {messages.map((m) => (
            <article
              key={m.id}
              className={`rounded-xl border p-4 shadow-xs ${m.role === "user" ? "bg-muted" : "bg-card"}`}
            >
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                {m.role === "user"
                  ? "Pergunta"
                  : m.role === "refusal"
                    ? "Recusa (fora do tema)"
                    : "Resposta"}{" "}
                · {formatOfficeDateTime(m.createdAt)}
              </p>
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {m.content}
              </p>
              {describeMasked(m.maskedCounts) && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {describeMasked(m.maskedCounts)}
                </p>
              )}
              {m.invalidCitations.length > 0 && (
                <p className="mt-2 text-xs font-medium text-warning-text">
                  Citações removidas por não estarem na base:{" "}
                  {m.invalidCitations.join(", ")}
                </p>
              )}
            </article>
          ))}
        </main>
      </>
    );
  }

  if (serventia) {
    const conversations = await listTenantConversationsWith(db, serventia);
    return (
      <>
        <AdminPageHeader
          maxWidth={900}
          title={nameOf(serventia)}
          back={{
            href: "/admin/atrios/assistente-dpo",
            label: "Assistente do DPO",
          }}
          description="Conversas como foram gravadas, com os dados pessoais já ocultados."
        />
        <main className="flex max-w-[900px] flex-col gap-2 px-4 pt-6 pb-8 md:px-8">
          {conversations.length === 0 ? (
            <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
              Nenhuma conversa.
            </p>
          ) : (
            conversations.map((c) => (
              <Link
                key={c.id}
                href={`/admin/atrios/assistente-dpo?conversa=${c.id}`}
                className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3 shadow-xs hover:bg-muted"
              >
                <span className="text-sm font-medium [overflow-wrap:anywhere]">
                  {c.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  {ROLE_NAMES[c.userRole] ?? c.userRole}
                  {c.kind === "reply-draft"
                    ? " · rascunho de resposta LGPD"
                    : c.kind === "data-rights"
                      ? " · conversa de requerimento LGPD"
                      : ""}{" "}
                  · {formatOfficeDateTime(c.lastMessageAt)}
                </span>
              </Link>
            ))
          )}
        </main>
      </>
    );
  }

  return (
    <>
      <AdminPageHeader maxWidth={900} title="Assistente do DPO" />
      <main className="flex max-w-[900px] flex-col gap-4 px-4 pt-6 pb-8 md:px-8">
        <section className="rounded-xl border bg-card p-6 text-sm leading-relaxed text-muted-foreground shadow-xs">
          Só a conta mestre vê esta tela. Uso do mês {month} por serventia
          (perguntas respondidas; recusas fora do tema não contam no teto). O
          teto vazio usa o padrão de 300. Cada mudança de teto fica na auditoria
          da serventia.
        </section>
        <ul className="flex flex-col gap-2.5">
          {tenants.map((tenant) => {
            const row = overview.find((o) => o.tenantSlug === tenant.slug);
            const limit = effectiveLimit(row?.limit);
            return (
              <li
                key={tenant.slug}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-xs"
              >
                <div className="min-w-0">
                  <Link
                    href={`/admin/atrios/assistente-dpo?serventia=${tenant.slug}`}
                    className="text-sm font-medium text-foreground hover:underline"
                  >
                    {tenant.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {row?.usage.answered ?? 0} de {limit} respondidas ·{" "}
                    {row?.usage.refused ?? 0} recusadas ·{" "}
                    {row?.conversations ?? 0} conversas
                    {row?.lastQuestionAt
                      ? ` · última em ${formatOfficeDateTime(row.lastQuestionAt)}`
                      : ""}
                  </p>
                </div>
                <LimitForm
                  slug={tenant.slug}
                  name={tenant.name}
                  limit={row?.limit ?? null}
                />
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}
