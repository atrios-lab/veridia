import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  auditActionLabel,
  DEFAULT_LEGAL_BASIS,
  targetInWords,
} from "@/core/audit/labels.ts";
import { PANEL_ROLES, type Role } from "@/core/auth/roles.ts";
import { formatOfficeDateTime } from "@/core/time/office-time.ts";
import { user } from "@/db/auth-schema.ts";
import { db } from "@/db/index.ts";
import { listAuditWith } from "@/lib/audit-trail.ts";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { ROLE_LABELS } from "../../../../_components/role-labels.ts";
import { auditAccess } from "../../access.ts";
import { NewNotificationForm } from "./form.tsx";

export const metadata = { title: "Nova notificação" };

const FACTS =
  "Constam no registro do painel desta serventia os atos abaixo relacionados, praticados com o seu usuário, que precisam ser esclarecidos.";

export default async function NewNotificationPage({
  searchParams,
}: {
  searchParams: Promise<{ pessoa?: string; ids?: string | string[] }>;
}) {
  const access = await auditAccess();
  if (!access?.manager) notFound();
  const { tenant, session } = access;
  const query = await searchParams;
  const ids = (
    Array.isArray(query.ids) ? query.ids : query.ids ? [query.ids] : []
  )
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
    .slice(0, 100);
  const [entries, people] = await Promise.all([
    ids.length
      ? listAuditWith(db, { tenantSlugs: [tenant.slug], ids })
      : Promise.resolve([]),
    db
      .select({ id: user.id, name: user.name, role: user.role })
      .from(user)
      .where(
        and(
          eq(user.tenantSlug, tenant.slug),
          inArray(user.role, [...PANEL_ROLES]),
          ne(user.id, session.user.id),
          isNull(user.disabledAt),
        ),
      )
      .orderBy(asc(user.name)),
  ]);
  // Acts of several people: one notification for each of them.
  const authors = [
    ...new Map(
      entries
        .filter((e) => e.actorId && e.actorId !== session.user.id)
        .map((e) => [e.actorId as string, e.actorName ?? ""]),
    ),
  ];
  const chosen =
    query.pessoa ?? (entries.length ? (entries[0]?.actorId ?? "") : "");

  return (
    <>
      <AdminPageHeader title="Auditoria" />
      <main className="flex max-w-[900px] flex-col gap-4.5 px-[30px] py-7">
        <Link
          href="/admin/auditoria"
          className="text-[12.5px] text-admin-muted hover:text-admin-primary"
        >
          ‹ Auditoria
        </Link>
        <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <h2 className="font-serif text-[18px] font-semibold text-admin-primary">
            Notificar para esclarecimentos
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-admin-muted">
            A pessoa recebe a notificação no e-mail da conta dela, com o PDF, e
            vê o pedido na aba Auditoria do painel. Ela tem 24 horas para
            responder, por lá. Revise o texto antes de enviar.
          </p>
          {entries.length > 0 && (
            <div className="mt-3 rounded-[10px] bg-admin-input-bg px-3.5 py-2.5">
              <p className="text-xs font-bold text-admin-primary">
                Atos que vão na notificação ({entries.length})
              </p>
              <ul className="mt-1 flex flex-col gap-0.5 text-[12.5px] text-admin-text">
                {entries.map((entry) => (
                  <li key={entry.id}>
                    {formatOfficeDateTime(entry.createdAt)} ·{" "}
                    {auditActionLabel(entry.action)}
                    {targetInWords(entry.targetType, entry.targetLabel) &&
                      ` · ${targetInWords(entry.targetType, entry.targetLabel)}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <NewNotificationForm
            ids={entries.map((entry) => entry.id)}
            people={people.map((person) => ({
              id: person.id,
              label: `${person.name} (${ROLE_LABELS[person.role as Role] ?? person.role})`,
            }))}
            defaultPerson={people.some((p) => p.id === chosen) ? chosen : ""}
            defaultFacts={FACTS}
            defaultLegalBasis={DEFAULT_LEGAL_BASIS}
            each={authors.length > 1 ? authors.map(([, name]) => name) : null}
          />
        </section>
      </main>
    </>
  );
}
