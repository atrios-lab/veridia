import Link from "next/link";
import {
  BOOK_DOC_LABELS,
  type BookDocKind,
  brDate,
  categoryLabel,
  monthLabel,
  summarize,
} from "@/core/daily-book/book.ts";
import { toIsoDate } from "@/core/scheduling/calendar.ts";
import { OFFICE_TIME_ZONE } from "@/core/time/office-time.ts";
import { formatMoneyBRL } from "@/core/transparency/bulletin.ts";
import { db } from "@/db/index.ts";
import {
  entryOf,
  listBookReportsWith,
  listEntriesWith,
} from "@/lib/daily-book.ts";
import { getGuideSettings } from "@/lib/tax-guides.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { AdminIcon } from "../../../_components/icon.tsx";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { monthPeriod, requireBookAccess } from "./_lib/access.ts";
import { RemoveEntryButton, ReportForm } from "./forms.tsx";

export const metadata = { title: "Livro Diário Auxiliar" };

const DONE: Record<string, string> = {
  importado: "Relatório lido e receitas lançadas no livro.",
  despesa: "Despesa lançada.",
  receita: "Receita lançada.",
  editado: "Lançamento corrigido.",
  "pagina-excluida": "Página excluída. Ela continua guardada.",
};

const TH =
  "px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.05em] text-admin-muted";
const TD = "px-3 py-2.5 align-top text-[13px] text-admin-text";
const m = (c: number) => `R$ ${formatMoneyBRL(c)}`;

function shiftMonth(month: string, delta: number): string {
  const [y, mo] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y ?? 2000, (mo ?? 1) - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function DailyBookPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; excluidos?: string; feito?: string }>;
}) {
  await requireBookAccess();
  const tenant = await getTenant();
  const query = await searchParams;
  const now = today();
  const month = /^\d{4}-\d{2}$/.test(query.mes ?? "")
    ? (query.mes as string)
    : now.slice(0, 7);
  const period = monthPeriod(month);
  const showRemoved = query.excluidos === "1";
  const [rows, reports, guide] = await Promise.all([
    listEntriesWith(db, tenant.slug, period, { withRemoved: showRemoved }),
    listBookReportsWith(db, tenant.slug),
    getGuideSettings(tenant),
  ]);
  const live = rows.filter((r) => !r.removedAt).map(entryOf);
  const sum = summarize(live);
  const done = query.feito ? DONE[query.feito] : undefined;
  // Art. 191-A: the expenses of the month by its end. The last 5 days.
  const lastDays =
    month === now.slice(0, 7) &&
    Number(period.end.slice(8)) - Number(now.slice(8)) < 5;
  const base = "/admin/utilitarios/livro-diario";

  return (
    <>
      <AdminPageHeader
        title="Livro Diário Auxiliar"
        description="Receita e despesa da serventia (Provimento CNJ nº 149/2023, com a redação do Provimento nº 259/2026): o relatório de produtividade lido ato por ato, as despesas com comprovante, o PDF do dia, do mês e o balanço do ano."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`${base}/importar`}
              className="btn btn-admin-primary btn-md"
            >
              <AdminIcon name="upload" className="h-4 w-4" /> Anexar
              produtividade
            </Link>
            <Link
              href={`${base}/lancamento?tipo=despesa`}
              className="btn btn-admin-secondary btn-md"
            >
              <AdminIcon name="plus" className="h-4 w-4" /> Lançar despesa
            </Link>
            <Link
              href={`${base}/lancamento?tipo=receita`}
              className="btn btn-admin-secondary btn-md"
            >
              <AdminIcon name="plus" className="h-4 w-4" /> Receita avulsa
            </Link>
          </div>
        }
      />
      <main className="flex max-w-[1150px] flex-col gap-5 px-[30px] py-7 max-md:px-4">
        {done && (
          <p className="rounded-[12px] bg-admin-success-bg px-4 py-3 text-[13px] font-semibold text-admin-success-text">
            {done}
          </p>
        )}
        {lastDays && (
          <p className="rounded-[12px] border border-admin-warning-soft-border bg-admin-warning-soft-bg px-4 py-3 text-[13px] text-admin-warning-text">
            <strong>Fim do mês:</strong> as despesas de{" "}
            {monthLabel(period.start)} precisam estar lançadas até{" "}
            {brDate(period.end)} (art. 191-A), com o comprovante.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`${base}?mes=${shiftMonth(month, -1)}`}
            className="btn btn-admin-secondary btn-sm"
          >
            ‹ Mês anterior
          </Link>
          <h2 className="font-serif text-[20px] font-semibold text-admin-primary">
            {monthLabel(period.start).charAt(0).toUpperCase()}
            {monthLabel(period.start).slice(1)}
          </h2>
          <Link
            href={`${base}?mes=${shiftMonth(month, 1)}`}
            className="btn btn-admin-secondary btn-sm"
          >
            Próximo mês ›
          </Link>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [
              "Receita (emolumentos)",
              m(sum.revenueCents),
              `${sum.acts.toLocaleString("pt-BR")} atos`,
            ],
            [
              "Despesa",
              m(sum.expensesCents),
              `${live.filter((e) => e.kind === "despesa").length} lançamento(s)`,
            ],
            [
              sum.balanceCents >= 0 ? "Saldo positivo" : "Saldo negativo",
              m(Math.abs(sum.balanceCents)),
              "art. 192",
            ],
            [
              "Repasses e ISS",
              m(sum.fundsCents),
              `ISS ${m(sum.issCents)} · não são receita`,
            ],
          ].map(([label, value, hint]) => (
            <div
              key={label}
              className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4"
            >
              <p className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-admin-muted">
                {label}
              </p>
              <p className="font-serif text-[24px] font-semibold text-admin-primary">
                {value}
              </p>
              <p className="text-[12px] text-admin-muted">{hint}</p>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-[14px] border border-admin-border bg-admin-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-admin-border px-5 py-3.5">
            <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
              Lançamentos do mês
            </h2>
            <Link
              href={`${base}?mes=${month}${showRemoved ? "" : "&excluidos=1"}`}
              className="text-[12.5px] font-semibold text-admin-primary underline"
            >
              {showRemoved
                ? "Esconder os excluídos"
                : "Mostrar também os excluídos"}
            </Link>
          </div>
          {rows.length === 0 ? (
            <p className="px-5 py-4 text-[13px] text-admin-muted">
              Nenhum lançamento neste mês. Comece em{" "}
              <strong>Anexar produtividade</strong> (as receitas) e{" "}
              <strong>Lançar despesa</strong>.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead className="border-b border-admin-border bg-admin-input-bg">
                  <tr>
                    <th className={TH}>Data</th>
                    <th className={TH}>Discriminação</th>
                    <th className={`${TH} text-right`}>Receita</th>
                    <th className={`${TH} text-right`}>Despesa</th>
                    <th className={TH}>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const e = entryOf(row);
                    const removed = row.removedAt !== null;
                    return (
                      <tr
                        key={row.id}
                        className={`border-b border-admin-border last:border-0 ${removed ? "opacity-55" : ""}`}
                      >
                        <td className={TD}>{brDate(e.date)}</td>
                        <td className={TD}>
                          <span
                            className={`font-semibold ${removed ? "line-through" : ""}`}
                          >
                            {e.kind === "receita"
                              ? e.specialty
                              : categoryLabel(e.category)}
                          </span>
                          <span className="block">
                            {e.actCode ? `${e.actCode} - ` : ""}
                            {e.description}
                            {e.quantity > 1 ? ` (${e.quantity} atos)` : ""}
                            {e.supplier ? ` · ${e.supplier}` : ""}
                          </span>
                          {(e.explanation || e.fiscalDistinct) && (
                            <span className="block text-[12px] text-admin-muted">
                              {e.fiscalDistinct
                                ? "Tratamento fiscal distinto. "
                                : ""}
                              {e.explanation}
                            </span>
                          )}
                          {removed && (
                            <span className="block text-[12px] text-admin-muted">
                              Excluído: {row.removeReason}
                            </span>
                          )}
                        </td>
                        <td className={`${TD} text-right`}>
                          {e.kind === "receita"
                            ? formatMoneyBRL(e.amountCents)
                            : ""}
                        </td>
                        <td className={`${TD} text-right`}>
                          {e.kind === "despesa"
                            ? formatMoneyBRL(e.amountCents)
                            : ""}
                        </td>
                        <td className={`${TD} text-right`}>
                          {!removed && (
                            <span className="inline-flex flex-wrap justify-end gap-1.5">
                              {e.hasAttachment && (
                                <a
                                  href={`${base}/lancamento/${row.id}/comprovante`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-admin-secondary btn-sm"
                                >
                                  Comprovante
                                </a>
                              )}
                              <Link
                                href={`${base}/lancamento?id=${row.id}`}
                                className="btn btn-admin-secondary btn-sm"
                              >
                                Editar
                              </Link>
                              <RemoveEntryButton id={row.id} />
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
            Gerar PDF do livro
          </h2>
          <ReportForm
            today={now}
            month={month}
            signers={guide.signers.map(({ name, title }) => ({ name, title }))}
          />
        </section>

        <section className="overflow-hidden rounded-[14px] border border-admin-border bg-admin-card">
          <h2 className="border-b border-admin-border px-5 py-3.5 font-serif text-[17px] font-semibold text-admin-primary">
            Páginas geradas
          </h2>
          {reports.length === 0 ? (
            <p className="px-5 py-4 text-[13px] text-admin-muted">
              Nenhuma página gerada ainda.
            </p>
          ) : (
            <ul>
              {reports.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 border-b border-admin-border px-5 py-3 last:border-0"
                >
                  <Link
                    href={`${base}/paginas/${r.id}`}
                    className="mr-auto text-[13.5px] font-semibold text-admin-primary underline"
                  >
                    {BOOK_DOC_LABELS[r.kind as BookDocKind]}:{" "}
                    {r.kind === "dia"
                      ? brDate(r.periodStart)
                      : r.kind === "mes"
                        ? monthLabel(r.periodStart)
                        : r.periodStart.slice(0, 4)}
                  </Link>
                  <span className="text-[12px] text-admin-muted">
                    gerada em {brDate(toIsoDate(r.createdAt, OFFICE_TIME_ZONE))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
