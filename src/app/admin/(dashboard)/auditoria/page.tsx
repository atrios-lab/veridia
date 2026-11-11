import Link from "next/link";
import { notFound } from "next/navigation";
import {
  auditActionExplanation,
  auditActionLabel,
  targetInWords,
} from "@/core/audit/labels.ts";
import {
  AUDIT_LEVEL_HINTS,
  AUDIT_LEVEL_LABELS,
  AUDIT_LEVELS,
  type AuditLevel,
} from "@/core/audit/severity.ts";
import type { Role } from "@/core/auth/roles.ts";
import { formatGuideNumber } from "@/core/guides/schema.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import { formatOfficeDateTime } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import {
  ALERT_DAYS,
  listAuditWith,
  listNotificationsWith,
  peopleSummaryWith,
} from "@/lib/audit-trail.ts";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import { ROLE_LABELS } from "../../_components/role-labels.ts";
import { auditAccess, trailScope } from "./access.ts";
import { PersonPicker } from "./person-picker.tsx";
import { TrailList } from "./trail-list.tsx";

export const metadata = { title: "Auditoria" };

const STATUS: Record<string, string> = {
  aberta: "Aguardando resposta",
  respondida: "Respondida",
  encerrada: "Encerrada",
};

const LEVEL_TONE: Record<AuditLevel, string> = {
  urgente: "bg-admin-error-bg text-admin-error-text",
  atencao: "bg-admin-warning-bg text-admin-warning-text",
  analise: "bg-admin-readonly-bg text-admin-primary",
  rotina: "bg-admin-input-bg text-admin-muted",
};

const CARD =
  "rounded-[14px] border border-admin-border bg-admin-card px-5 py-4";

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
                className="font-semibold text-admin-primary hover:underline [overflow-wrap:anywhere]"
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : ""}`.toUpperCase();
}

type Query = {
  pessoa?: string;
  de?: string;
  ate?: string;
  busca?: string;
  serventia?: string;
  nivel?: string;
  pendentes?: string;
  arquivados?: string;
  revisadas?: string;
  notificadas?: string;
};

/** The page's own address with some filters changed, others kept. */
function hrefWith(query: Query, change: Partial<Query>): string {
  const next = { ...query, ...change };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (value) params.set(key, value);
  }
  const text = params.toString();
  return text ? `/admin/auditoria?${text}` : "/admin/auditoria";
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
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
        <main className="flex max-w-[900px] flex-col gap-4.5 px-[30px] py-7 max-md:px-4">
          <section className={CARD}>
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
  const level = AUDIT_LEVELS.find((l) => l === query.nivel);
  const pending = query.pendentes === "1";
  const archivedView = query.arquivados === "1";
  const reviewedView = query.revisadas === "1" && !archivedView;
  const from = query.de ? new Date(`${query.de}T00:00:00-03:00`) : undefined;
  const to = query.ate ? new Date(`${query.ate}T23:59:59-03:00`) : undefined;
  const since = new Date(Date.now() - ALERT_DAYS * 24 * 60 * 60 * 1000);
  const [entries, notifications, people] = await Promise.all([
    listAuditWith(db, {
      includePlatform: platform,
      tenantSlugs: scope,
      actorId: query.pessoa || undefined,
      from: from && !Number.isNaN(from.getTime()) ? from : undefined,
      to: to && !Number.isNaN(to.getTime()) ? to : undefined,
      text: query.busca?.trim() || undefined,
      levels: level ? [level] : undefined,
      pending: pending && !reviewedView,
      reviewed: reviewedView,
      archived: archivedView,
      // The holder's own acts never wait for his own look.
      excludeActorId: pending ? session.user.id : undefined,
    }),
    listNotificationsWith(db, tenant.slug),
    peopleSummaryWith(db, scope, since, platform),
  ]);
  // The holder's own acts never wait for his own look.
  const totals = people.reduce(
    (sum, person) => {
      const own = person.actorId === session.user.id;
      return {
        pendentes: sum.pendentes + (own ? 0 : person.pendentes),
        atencao: sum.atencao + (own ? 0 : person.atencaoPendentes),
        analise: sum.analise + (own ? 0 : person.analisePendentes),
        analisadas: sum.analisadas + person.analisadas,
      };
    },
    { pendentes: 0, atencao: 0, analise: 0, analisadas: 0 },
  );
  const chosenPerson = people.find((p) => p.actorId === query.pessoa);
  const FIELD =
    "w-full min-w-0 rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3 py-2 text-[13px] text-admin-text outline-none focus:border-admin-primary-soft";
  const LABEL =
    "flex min-w-0 flex-col gap-1 text-xs font-bold text-admin-primary";

  const bandHref = (nivel: AuditLevel) =>
    hrefWith(query, {
      nivel,
      pendentes: "1",
      revisadas: undefined,
      arquivados: undefined,
    });
  const summary: {
    key: string;
    label: string;
    tone: string;
    value: number;
    caption: string;
    hint: string;
    href: string;
    active: boolean;
  }[] = [
    {
      key: "urgente",
      label: AUDIT_LEVEL_LABELS.urgente,
      tone: LEVEL_TONE.urgente,
      value: totals.pendentes,
      caption: "aguardando verificação",
      hint: AUDIT_LEVEL_HINTS.urgente,
      href: bandHref("urgente"),
      active: level === "urgente" && !reviewedView,
    },
    {
      key: "atencao",
      label: AUDIT_LEVEL_LABELS.atencao,
      tone: LEVEL_TONE.atencao,
      value: totals.atencao,
      caption: `a conferir, últimos ${ALERT_DAYS} dias`,
      hint: AUDIT_LEVEL_HINTS.atencao,
      href: bandHref("atencao"),
      active: level === "atencao" && !reviewedView,
    },
    {
      key: "analise",
      label: AUDIT_LEVEL_LABELS.analise,
      tone: LEVEL_TONE.analise,
      value: totals.analise,
      caption: `a conferir, últimos ${ALERT_DAYS} dias`,
      hint: AUDIT_LEVEL_HINTS.analise,
      href: bandHref("analise"),
      active: level === "analise" && !reviewedView,
    },
    {
      key: "analisadas",
      label: "Analisadas e concluídas",
      tone: "bg-admin-success-bg text-admin-success-text",
      value: totals.analisadas,
      caption: `lidas e ok, últimos ${ALERT_DAYS} dias`,
      hint: 'O que você marcou como "lido e ok" sai das outras faixas e fica aqui, para consulta.',
      href: hrefWith(query, {
        revisadas: "1",
        nivel: undefined,
        pendentes: undefined,
        arquivados: undefined,
      }),
      active: reviewedView,
    },
  ];

  return (
    <>
      <AdminPageHeader title="Auditoria" />
      <main className="flex max-w-[1100px] flex-col gap-4.5 px-[30px] py-7 max-md:px-4">
        {query.notificadas && (
          <p className="rounded-[12px] bg-admin-success-bg px-4 py-3 text-[13px] font-semibold text-admin-success-text">
            {query.notificadas} notificações enviadas, uma para cada pessoa.
            Elas aparecem em &quot;Notificações enviadas&quot;, mais abaixo.
          </p>
        )}
        {/* The three bands still to check, and what was already checked:
            each one opens its list. Only "Urgente" alerts. */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summary.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              title={item.hint}
              className={`flex min-w-0 flex-col rounded-[14px] border px-4 py-3 transition-colors hover:border-admin-primary ${item.active ? "border-admin-primary bg-admin-card" : "border-admin-border bg-admin-card"}`}
            >
              <span
                className={`w-fit rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] ${item.tone}`}
              >
                {item.label}
              </span>
              <span className="mt-1.5 font-serif text-[26px] font-semibold leading-none text-admin-primary">
                {item.value}
              </span>
              <span className="mt-1 text-[12px] text-admin-muted">
                {item.caption}
              </span>
              <span className="mt-1.5 text-[11.5px] leading-snug text-admin-muted">
                {item.hint}
              </span>
            </Link>
          ))}
        </section>

        {/* The trail divided by person: who did what, by band. */}
        <section className={CARD}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
              Por pessoa
            </h2>
            <span className="text-[12px] text-admin-muted">
              últimos {ALERT_DAYS} dias
            </span>
          </div>
          {people.length === 0 ? (
            <p className="mt-2 text-[13px] text-admin-muted">
              Nenhum ato no período.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:items-end">
              <PersonPicker
                value={chosenPerson?.actorId ?? ""}
                allHref={hrefWith(query, { pessoa: undefined })}
                options={people.map((person) => {
                  const own = person.actorId === session.user.id;
                  const flags = [
                    !own && person.pendentes > 0
                      ? `${person.pendentes} urgente${person.pendentes > 1 ? "s" : ""}`
                      : "",
                    !own && person.atencaoPendentes > 0
                      ? `${person.atencaoPendentes} atenção`
                      : "",
                  ].filter(Boolean);
                  const role =
                    ROLE_LABELS[(person.role ?? "") as Role] ?? person.role;
                  const office =
                    scope === "all"
                      ? ` · ${TENANTS[person.tenantSlug]?.name ?? person.tenantSlug}`
                      : "";
                  return {
                    value: person.actorId,
                    label: `${flags.length ? "⚠ " : ""}${person.name} (${role}${office}) · ${person.total} atos${flags.length ? ` · ${flags.join(", ")}` : ""}`,
                    href: hrefWith(query, { pessoa: person.actorId }),
                  };
                })}
              />
              {chosenPerson ? (
                <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-[12px] border border-admin-primary bg-admin-input-bg px-3 py-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-admin-primary text-[11.5px] font-bold text-white">
                    {initials(chosenPerson.name)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-admin-primary">
                    {chosenPerson.name}
                  </span>
                  {chosenPerson.actorId !== session.user.id &&
                    chosenPerson.pendentes > 0 && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${LEVEL_TONE.urgente}`}
                      >
                        {chosenPerson.pendentes} urgente
                        {chosenPerson.pendentes > 1 ? "s" : ""}
                      </span>
                    )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${LEVEL_TONE.atencao}`}
                  >
                    {chosenPerson.atencao} atenção
                  </span>
                  <span className="rounded-full bg-admin-success-bg px-2 py-0.5 text-[10.5px] font-bold text-admin-success-text">
                    {chosenPerson.analisadas} analisadas
                  </span>
                  <Link
                    href={hrefWith(query, { pessoa: undefined })}
                    className="text-[12px] font-semibold text-admin-muted underline hover:text-admin-primary"
                  >
                    Ver todas
                  </Link>
                </div>
              ) : (
                <p className="text-[12px] leading-snug text-admin-muted">
                  {people.length} pessoa{people.length > 1 ? "s" : ""} com atos
                  no período. Quem tem urgente esperando aparece primeiro, com
                  ⚠.
                </p>
              )}
            </div>
          )}
        </section>

        <section className={CARD}>
          <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
            {chosenPerson
              ? `Atos de ${chosenPerson.name}`
              : "Registros do painel"}
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-admin-muted">
            Os registros nunca mudam. Anote, marque os que interessam para gerar
            o PDF, enviar por e-mail ou notificar a pessoa. O que você marcar
            como &quot;lido e ok&quot; sai da faixa e vai para &quot;Analisadas
            e concluídas&quot;. Só os urgentes ficam em alerta.
          </p>

          {/* Band chips: the most used filter, one tap. */}
          <nav
            aria-label="Faixa"
            className="mt-3 flex flex-wrap gap-1.5 text-[12.5px]"
          >
            <Link
              href={hrefWith(query, {
                nivel: undefined,
                pendentes: undefined,
                revisadas: undefined,
              })}
              className={`rounded-full border px-3 py-1 font-semibold ${!level && !reviewedView ? "border-admin-primary bg-admin-primary text-white" : "border-admin-border text-admin-muted hover:text-admin-primary"}`}
            >
              Todas
            </Link>
            {AUDIT_LEVELS.map((item) => (
              <Link
                key={item}
                href={hrefWith(query, {
                  nivel: item,
                  pendentes: item === "rotina" ? undefined : query.pendentes,
                  revisadas: undefined,
                })}
                className={`rounded-full border px-3 py-1 font-semibold ${level === item && !reviewedView ? "border-admin-primary bg-admin-primary text-white" : "border-admin-border text-admin-muted hover:text-admin-primary"}`}
              >
                {AUDIT_LEVEL_LABELS[item]}
              </Link>
            ))}
            {level && level !== "rotina" && !reviewedView && (
              <Link
                href={hrefWith(query, { pendentes: pending ? undefined : "1" })}
                className={`rounded-full border px-3 py-1 font-semibold ${pending ? "border-admin-error-text bg-admin-error-bg text-admin-error-text" : "border-admin-border text-admin-muted"}`}
              >
                {pending ? "✓ Só pendentes" : "Só pendentes"}
              </Link>
            )}
            <Link
              href={hrefWith(query, {
                arquivados: archivedView ? undefined : "1",
              })}
              className={`rounded-full border px-3 py-1 font-semibold ${archivedView ? "border-admin-primary bg-admin-primary text-white" : "border-admin-border text-admin-muted hover:text-admin-primary"}`}
            >
              Arquivados
            </Link>
            <Link
              href={hrefWith(query, {
                revisadas: reviewedView ? undefined : "1",
                pendentes: undefined,
                arquivados: undefined,
              })}
              className={`rounded-full border px-3 py-1 font-semibold ${reviewedView ? "border-admin-success-text bg-admin-success-bg text-admin-success-text" : "border-admin-border text-admin-muted hover:text-admin-primary"}`}
            >
              {reviewedView ? "✓ Analisadas" : "Analisadas"}
            </Link>
          </nav>

          <details
            className="group mt-3 rounded-[12px] bg-admin-input-bg px-3.5 py-2.5"
            open={Boolean(query.de || query.ate || query.busca)}
          >
            <summary className="cursor-pointer select-none text-[12.5px] font-semibold text-admin-primary">
              Mais filtros (período, busca
              {platform ? ", serventia" : ""})
            </summary>
            <form className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-[1fr_1fr_2fr_auto] md:items-end">
              {query.pessoa && (
                <input type="hidden" name="pessoa" value={query.pessoa} />
              )}
              {level && <input type="hidden" name="nivel" value={level} />}
              {pending && <input type="hidden" name="pendentes" value="1" />}
              {reviewedView && (
                <input type="hidden" name="revisadas" value="1" />
              )}
              {platform && (
                <label className={`${LABEL} col-span-2 md:col-span-4`}>
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
              <label className={LABEL}>
                De
                <input
                  type="date"
                  name="de"
                  defaultValue={query.de ?? ""}
                  className={FIELD}
                />
              </label>
              <label className={LABEL}>
                Até
                <input
                  type="date"
                  name="ate"
                  defaultValue={query.ate ?? ""}
                  className={FIELD}
                />
              </label>
              <label className={`${LABEL} col-span-2 md:col-span-1`}>
                Buscar
                <input
                  name="busca"
                  defaultValue={query.busca ?? ""}
                  placeholder="Protocolo, ação..."
                  className={FIELD}
                />
              </label>
              <button
                type="submit"
                className="btn btn-admin-secondary btn-md col-span-2 md:col-span-1"
              >
                Filtrar
              </button>
            </form>
          </details>

          <TrailList
            serventia={query.serventia ?? ""}
            archivedView={archivedView}
            showOffice={scope === "all" || scope[0] !== tenant.slug}
            entries={entries.map((entry) => {
              const when = formatOfficeDateTime(entry.createdAt);
              return {
                id: entry.id,
                tenantName: TENANTS[entry.tenantSlug]?.name ?? entry.tenantSlug,
                day: when.split(",")[0] ?? when,
                time: when.split(", ")[1] ?? "",
                who: entry.actorName ?? "Sistema",
                role: entry.actorName
                  ? (ROLE_LABELS[(entry.actorRole ?? "") as Role] ??
                    entry.actorRole ??
                    "")
                  : "",
                actorId: entry.actorId,
                what: auditActionLabel(entry.action),
                code: entry.action,
                level: entry.level,
                reason: entry.reason,
                reviewed: entry.reviewedAt
                  ? `Lido e ok por ${entry.reviewerName ?? "Tabelião/Registrador"} em ${formatOfficeDateTime(entry.reviewedAt)}`
                  : null,
                // The person's own sign-in names them once, not twice.
                target: (() => {
                  const words = targetInWords(
                    entry.targetType,
                    entry.targetLabel,
                  );
                  return words && words !== entry.actorName ? words : "";
                })(),
                explanation: auditActionExplanation(entry.action),
                notes: entry.notes.map((note) => ({
                  id: note.id,
                  body: note.body,
                  meta: `${note.authorName ?? ""} · ${formatOfficeDateTime(note.createdAt)}${note.editedAt ? ` · editada em ${formatOfficeDateTime(note.editedAt)}` : ""}`,
                })),
              };
            })}
          />
        </section>

        <section className={CARD}>
          <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
            Notificações enviadas
          </h2>
          <NotificationList items={notifications} showPerson />
        </section>
      </main>
    </>
  );
}
