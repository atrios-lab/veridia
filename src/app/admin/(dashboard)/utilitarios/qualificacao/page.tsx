import Link from "next/link";
import { can } from "@/core/auth/roles.ts";
import { qualificationDeadline } from "@/core/qualificacao/prazos.ts";
import {
  ATTRIBUTIONS,
  actName,
  daysSince,
  isAttribution,
  STATUS_LABELS,
} from "@/core/qualificacao/qualificacao.ts";
import { officeHolidays } from "@/core/scheduling/calendar.ts";
import { db } from "@/db/index.ts";
import { feeTableReferenceWith } from "@/lib/fee-tables.ts";
import {
  getDeadlineSettingsWith,
  listQualificationsWith,
} from "@/lib/qualificacao.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { FeeTableReminder } from "../../../_components/fee-table-reminder.tsx";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { TirarDuvida } from "../../../_components/tirar-duvida.tsx";
import { buttonVariants } from "../../../_ui/button.tsx";
import { requireQualificacao } from "./_access.ts";

export const metadata = { title: "Qualificação de títulos" };

const BASE = "/admin/utilitarios/qualificacao";
const TONE = {
  "em-analise": "bg-primary/10 text-foreground",
  exigencia: "bg-warning-soft text-warning-text",
  reapresentado: "bg-primary/10 text-foreground",
  positiva: "bg-muted text-muted-foreground",
} as const;

export default async function QualificationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    atribuicao?: string;
    excluidas?: string;
    situacao?: string;
  }>;
}) {
  const session = await requireQualificacao();
  const { atribuicao = "", excluidas, situacao = "" } = await searchParams;
  const attribution = isAttribution(atribuicao) ? atribuicao : undefined;
  const removedView = excluidas === "1";
  const tenant = await getTenant();
  const [all, deadlines, feeTable] = await Promise.all([
    listQualificationsWith(db, tenant.slug, {
      attribution,
      removed: removedView,
    }),
    getDeadlineSettingsWith(db, tenant.slug),
    feeTableReferenceWith(db, tenant.slug),
  ]);
  const holidays = officeHolidays(tenant);
  const now = today();
  const withDue = all.map((q) => ({
    q,
    due: removedView
      ? null
      : qualificationDeadline(q.data, deadlines, now, holidays),
  }));
  const filtered = situacao
    ? withDue.filter(({ q }) => q.status === situacao)
    : withDue;
  // What is late, then what is due, first: the rest in the order received.
  const rank = (d: (typeof withDue)[number]["due"]) =>
    d?.late ? 0 : d?.soon ? 1 : 2;
  const shown = [...filtered].sort((a, b) => rank(a.due) - rank(b.due));
  const lateCount = withDue.filter(({ due }) => due?.late).length;
  const query = (extra: Record<string, string>) => {
    const params = new URLSearchParams({
      ...(attribution ? { atribuicao: attribution } : {}),
      ...(situacao ? { situacao } : {}),
      ...extra,
    });
    for (const [k, v] of [...params.entries()]) if (!v) params.delete(k);
    const s = params.toString();
    return s ? `${BASE}?${s}` : BASE;
  };

  return (
    <>
      <AdminPageHeader
        maxWidth={1100}
        title="Qualificação de títulos"
        description="Cada título apresentado é examinado e recebe a nota devolutiva, com as exigências de uma só vez e fundamentadas, ou a qualificação positiva. Todas as atribuições da serventia, começando pelo Registro Civil."
      />
      <main className="flex max-w-[1100px] flex-col gap-6 px-4 py-7 md:px-8">
        <TirarDuvida topic="qualificacao" />
        <FeeTableReminder
          table={feeTable}
          canUpdate={can(
            session.user.role ?? "",
            "transparency.manage",
            session.user.permissions,
          )}
        />
        <div className="flex flex-wrap gap-2">
          <Link href={`${BASE}/nova`} className={buttonVariants()}>
            Nova qualificação
          </Link>
          <Link
            href={`${BASE}/biblioteca`}
            className={buttonVariants({ variant: "outline" })}
          >
            Biblioteca de exigências
          </Link>
          <Link
            href={`${BASE}/prazos`}
            className={buttonVariants({ variant: "outline" })}
          >
            Prazos
          </Link>
          <Link
            href={removedView ? BASE : `${BASE}?excluidas=1`}
            className={buttonVariants({ variant: "ghost" })}
          >
            {removedView ? "Voltar à lista" : "Ver excluídas"}
          </Link>
        </div>
        {lateCount > 0 && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-3 text-sm text-foreground">
            {lateCount === 1
              ? "1 título passou do prazo para registrar ou devolver com a nota."
              : `${lateCount} títulos passaram do prazo para registrar ou devolver com a nota.`}
          </p>
        )}
        {!removedView && (
          <nav aria-label="Filtros" className="flex flex-wrap gap-2 text-sm">
            <Link
              href={query({ atribuicao: "" })}
              aria-current={!attribution ? "true" : undefined}
              className={buttonVariants({
                variant: attribution ? "ghost" : "secondary",
                size: "sm",
              })}
            >
              Todas as atribuições
            </Link>
            {Object.entries(ATTRIBUTIONS).map(([value, label]) => (
              <Link
                key={value}
                href={query({ atribuicao: value })}
                aria-current={attribution === value ? "true" : undefined}
                className={buttonVariants({
                  variant: attribution === value ? "secondary" : "ghost",
                  size: "sm",
                })}
              >
                {label}
              </Link>
            ))}
          </nav>
        )}
        {!removedView && (
          <nav aria-label="Situação" className="flex flex-wrap gap-2 text-sm">
            {[["", "Todas"], ...Object.entries(STATUS_LABELS)].map(
              ([value, label]) => (
                <Link
                  key={value || "todas"}
                  href={query({ situacao: value })}
                  aria-current={situacao === value ? "true" : undefined}
                  className={buttonVariants({
                    variant: situacao === value ? "secondary" : "ghost",
                    size: "sm",
                  })}
                >
                  {label}
                </Link>
              ),
            )}
          </nav>
        )}
        <section className="rounded-xl border bg-card shadow-xs">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-4">
            <h2 className="text-lg font-semibold text-foreground">
              {removedView
                ? "Qualificações excluídas"
                : "Títulos em qualificação"}
            </h2>
            <span className="text-sm text-muted-foreground">
              {shown.length} {shown.length === 1 ? "título" : "títulos"}
            </span>
          </div>
          {shown.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              {removedView
                ? "Nenhuma qualificação excluída."
                : "Nenhum título aqui. Comece em Nova qualificação."}
            </p>
          ) : (
            <ul className="divide-y">
              {shown.map(({ q, due }) => (
                <li
                  key={q.id}
                  className="flex flex-col gap-1 px-5 py-3 text-sm sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <Link
                      href={`${BASE}/${q.id}`}
                      className="font-medium text-foreground underline-offset-2 hover:underline"
                    >
                      {actName(q.data)} · {q.data.presenter.name}
                    </Link>
                    <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                      {ATTRIBUTIONS[q.data.attribution]}
                      {q.data.protocol ? ` · ${q.data.protocol}` : ""} ·{" "}
                      {q.data.document}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-xs">
                    <span
                      className={`rounded-full px-2 py-0.5 ${TONE[q.status]}`}
                    >
                      {STATUS_LABELS[q.status]}
                    </span>
                    {due && (
                      <span
                        className={`rounded-full px-2 py-0.5 ${
                          due.late
                            ? "bg-destructive/10 text-destructive"
                            : due.soon
                              ? "bg-warning-soft text-warning-text"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {due.late ? "Venceu em " : "Prazo até "}
                        {due.due.split("-").reverse().join("/")}
                      </span>
                    )}
                    <span className="text-muted-foreground">
                      {daysSince(q.data.receivedOn, now)} dias desde a
                      apresentação
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
