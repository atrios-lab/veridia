import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auditActionLabel } from "@/core/audit/labels.ts";
import type { Role } from "@/core/auth/roles.ts";
import { formatGuideNumber } from "@/core/guides/schema.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import { formatOfficeDateTime } from "@/core/time/office-time.ts";
import { user } from "@/db/auth-schema.ts";
import { db } from "@/db/index.ts";
import { listAuditWith, listNotificationsWith } from "@/lib/audit-trail.ts";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import { ROLE_LABELS } from "../../_components/role-labels.ts";
import { auditAccess, trailScope } from "./access.ts";
import { TrailList } from "./trail-list.tsx";

export const metadata = { title: "Auditoria" };

const STATUS: Record<string, string> = {
  aberta: "Aguardando resposta",
  respondida: "Respondida",
  encerrada: "Encerrada",
};

function NotificationList({
  items,
  showPerson,
}: {
  items: Awaited<ReturnType<typeof listNotificationsWith>>;
  showPerson: boolean;
}) {
  if (!items.length) {
    return (
      <p className="mt-2 text-[13px] text-admin-muted">Nenhuma notificação.</p>
    );
  }
  const now = Date.now();
  return (
    <ul className="mt-2 flex flex-col divide-y divide-admin-border">
      {items.map((item) => {
        const late =
          item.status === "aberta" && item.deadlineAt.getTime() < now;
        return (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[13px]"
          >
            <div className="min-w-0">
              <Link
                href={`/admin/auditoria/notificacao/${item.id}`}
                className="font-semibold text-admin-primary hover:underline"
              >
                Nº {formatGuideNumber(item.year, item.sequence)} ·{" "}
                {item.subject}
              </Link>
              <p className="text-[12px] text-admin-muted">
                {showPerson && `${item.targetName ?? ""} · `}
                enviada em {formatOfficeDateTime(item.createdAt)} · prazo{" "}
                {formatOfficeDateTime(item.deadlineAt)}
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${item.status === "aberta" ? (late ? "bg-admin-error-bg text-admin-error-text" : "bg-admin-warning-bg text-admin-warning-text") : "bg-admin-success-bg text-admin-success-text"}`}
            >
              {late ? "Prazo vencido" : (STATUS[item.status] ?? item.status)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    pessoa?: string;
    de?: string;
    ate?: string;
    busca?: string;
    serventia?: string;
    enviado?: string;
  }>;
}) {
  const access = await auditAccess();
  if (!access) notFound();
  const { tenant, session, manager, platform } = access;
  const query = await searchParams;

  // Anyone else: only the notifications addressed to them.
  if (!manager) {
    const mine = await listNotificationsWith(db, tenant.slug, session.user.id);
    return (
      <>
        <AdminPageHeader title="Auditoria" />
        <main className="flex max-w-[900px] flex-col gap-4.5 px-[30px] py-7">
          <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
            <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
              Minhas notificações
            </h2>
            <p className="mt-1 text-[12.5px] text-admin-muted">
              Pedidos de esclarecimento do Tabelião/Registrador endereçados a
              você. Responda em até 24 horas, por aqui.
            </p>
            <NotificationList items={mine} showPerson={false} />
          </section>
        </main>
      </>
    );
  }

  const scope = trailScope(access, query.serventia);
  const from = query.de ? new Date(`${query.de}T00:00:00-03:00`) : undefined;
  const to = query.ate ? new Date(`${query.ate}T23:59:59-03:00`) : undefined;
  const [entries, notifications, people] = await Promise.all([
    listAuditWith(db, {
      tenantSlugs: scope,
      actorId: query.pessoa || undefined,
      from: from && !Number.isNaN(from.getTime()) ? from : undefined,
      to: to && !Number.isNaN(to.getTime()) ? to : undefined,
      text: query.busca?.trim() || undefined,
    }),
    listNotificationsWith(db, tenant.slug),
    db
      .select({ id: user.id, name: user.name, role: user.role })
      .from(user)
      .where(eq(user.tenantSlug, tenant.slug))
      .orderBy(asc(user.name)),
  ]);
  const FIELD =
    "rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3 py-2 text-[13px] text-admin-text outline-none focus:border-admin-primary-soft";

  return (
    <>
      <AdminPageHeader title="Auditoria" />
      <main className="flex max-w-[1100px] flex-col gap-4.5 px-[30px] py-7">
        <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
            Notificações enviadas
          </h2>
          <NotificationList items={notifications} showPerson />
        </section>

        <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
            Registros do painel
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-admin-muted">
            Tudo o que foi feito no painel, por quem e quando. Os registros
            nunca mudam: você pode anotar, marcar os que interessam para gerar o
            PDF, enviar por e-mail ou notificar a pessoa para explicar.
          </p>
          <form className="mt-3 flex flex-wrap items-end gap-2.5">
            {platform && (
              <label className="flex flex-col gap-1 text-xs font-bold text-admin-primary">
                Serventia
                <select
                  name="serventia"
                  defaultValue={query.serventia ?? tenant.slug}
                  className={FIELD}
                >
                  <option value="todas">Todas as serventias</option>
                  {Object.values(TENANTS).map((t) => (
                    <option key={t.slug} value={t.slug}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1 text-xs font-bold text-admin-primary">
              Pessoa
              <select
                name="pessoa"
                defaultValue={query.pessoa ?? ""}
                className={FIELD}
              >
                <option value="">Todas</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} (
                    {ROLE_LABELS[person.role as Role] ?? person.role})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-admin-primary">
              De
              <input
                type="date"
                name="de"
                defaultValue={query.de ?? ""}
                className={FIELD}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-admin-primary">
              Até
              <input
                type="date"
                name="ate"
                defaultValue={query.ate ?? ""}
                className={FIELD}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-admin-primary">
              Buscar
              <input
                name="busca"
                defaultValue={query.busca ?? ""}
                placeholder="Protocolo, ação..."
                className={FIELD}
              />
            </label>
            <button type="submit" className="btn btn-admin-secondary btn-md">
              Filtrar
            </button>
          </form>
          <TrailList
            serventia={query.serventia ?? ""}
            showOffice={
              scope === "all" ||
              (Array.isArray(scope) && scope[0] !== tenant.slug)
            }
            entries={entries.map((entry) => ({
              id: entry.id,
              tenantName: TENANTS[entry.tenantSlug]?.name ?? entry.tenantSlug,
              when: formatOfficeDateTime(entry.createdAt),
              who: entry.actorName
                ? `${entry.actorName} (${ROLE_LABELS[(entry.actorRole ?? "") as Role] ?? entry.actorRole ?? ""})`
                : "Sistema",
              actorId: entry.actorId,
              what: auditActionLabel(entry.action),
              code: entry.action,
              // The person's own sign-in names them once, not twice.
              target:
                entry.targetLabel && entry.targetLabel !== entry.actorName
                  ? entry.targetLabel
                  : "",
              notes: entry.notes.map((note) => ({
                id: note.id,
                body: note.body,
                meta: `${note.authorName ?? ""} · ${formatOfficeDateTime(note.createdAt)}`,
              })),
            }))}
          />
        </section>
      </main>
    </>
  );
}
