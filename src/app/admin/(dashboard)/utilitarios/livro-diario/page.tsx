import Link from "next/link";
import { can } from "@/core/auth/roles.ts";
import {
  BOOK_DOC_LABELS,
  type BookDocKind,
  brDate,
  categoryLabel,
  monthLabel,
  summarize,
} from "@/core/daily-book/book.ts";
import { bookDuties } from "@/core/daily-book/deadlines.ts";
import { officeHolidays, toIsoDate } from "@/core/scheduling/calendar.ts";
import { OFFICE_TIME_ZONE } from "@/core/time/office-time.ts";
import { formatMoneyBRL } from "@/core/transparency/bulletin.ts";
import { db } from "@/db/index.ts";
import {
  entryOf,
  getBookSettingsWith,
  listBookReportsWith,
  listEntriesWith,
  snapshotOf,
} from "@/lib/daily-book.ts";
import { getGuideSettings } from "@/lib/tax-guides.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { AdminIcon } from "../../../_components/icon.tsx";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { INTERIM_EXCESS_HELP } from "../../../_components/screen-help.ts";
import { ScreenHelpButton } from "../../../_components/screen-help-button.tsx";
import { monthPeriod, requireBookAccess } from "./_lib/access.ts";
import { sendMonthToBulletin } from "./actions.ts";
import { RemoveEntryButton, ReportForm } from "./forms.tsx";

export const metadata = { title: "Livro Diário Auxiliar" };

const DONE: Record<string, string> = {
  importado: "Relatório lido e receitas lançadas no livro.",
  despesa: "Despesa lançada.",
  receita: "Receita lançada.",
  deposito: "Depósito lançado (art. 194, I).",
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
  const session = await requireBookAccess();
  const tenant = await getTenant();
  // The monthly bulletin is the Transparência's: its own permission.
  const canBulletin = can(
    session.user.role ?? "",
    "transparency.manage",
    session.user.permissions,
  );
  const query = await searchParams;
  const now = today();
  const month = /^\d{4}-\d{2}$/.test(query.mes ?? "")
    ? (query.mes as string)
    : now.slice(0, 7);
  const period = monthPeriod(month);
  const showRemoved = query.excluidos === "1";
  const [rows, reports, guide, settings] = await Promise.all([
    listEntriesWith(db, tenant.slug, period, { withRemoved: showRemoved }),
    listBookReportsWith(db, tenant.slug),
    getGuideSettings(tenant),
    getBookSettingsWith(db, tenant.slug),
  ]);
  // CN art. 193 and, in RN, arts. 61 and 62 of the CGJ/RN's code.
  const lastYear = String(Number(now.slice(0, 4)) - 1);
  const balance = reports.find(
    (r) =>
      r.kind === "ano" && !r.removedAt && r.periodStart.startsWith(lastYear),
  );
  const duties = bookDuties(now, {
    holidays: officeHolidays(tenant),
    state: tenant.location.state,
    lastYearBalanceOn: balance ? snapshotOf(balance).issuedOn : null,
    interim: settings.interim,
    interimPeriod: settings.interimPeriod,
  });
  // Art. 186: the book is opened by the holder before it is written in.
  const opened = reports.some(
    (r) =>
      r.kind === "abertura" &&
      !r.removedAt &&
      snapshotOf(r).book?.number === settings.bookNumber,
  );
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
        description="Código Nacional de Normas (Provimento CNJ nº 149/2023, arts. 185 a 195-D, com a redação do Provimento CNJ nº 259/2026): termos de abertura e encerramento, receita por especialidade no dia do ato, despesas até o fim do mês, apuração mensal e balanço anual."
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
              <AdminIcon name="plus" className="h-4 w-4" /> Lançar receita
            </Link>
            {settings.interim && (
              <Link
                href={`${base}/excedente`}
                className="btn btn-admin-secondary btn-md"
              >
                <AdminIcon name="grid" className="h-4 w-4" /> Calculadora do
                excedente
              </Link>
            )}
            {settings.interim && (
              <Link
                href={`${base}/lancamento?tipo=deposito`}
                className="btn btn-admin-secondary btn-md"
              >
                <AdminIcon name="plus" className="h-4 w-4" /> Depósito do
                excedente
              </Link>
            )}
          </div>
        }
      />
      <main className="flex max-w-[1150px] flex-col gap-5 px-[30px] py-7 max-md:px-4">
        {done && (
          <p className="rounded-[12px] bg-admin-success-bg px-4 py-3 text-[13px] font-semibold text-admin-success-text">
            {done}
          </p>
        )}
        {settings.interim && (
          <div className="flex flex-wrap items-center gap-2.5 rounded-[12px] border border-admin-border bg-admin-card px-4 py-3 text-[13px] text-admin-text">
            <strong className="text-admin-primary">
              Interino: excedente de 90,25% do subsídio de ministro do STF
            </strong>
            <ScreenHelpButton
              help={INTERIM_EXCESS_HELP}
              canConfigure
              label="O que é o excedente de 90,25% do STF, com exemplos"
            />
            <Link
              href={`${base}/excedente`}
              className="ml-auto text-[12.5px] font-semibold text-admin-primary underline"
            >
              Abrir a calculadora
            </Link>
          </div>
        )}
        {!opened && (
          <p className="rounded-[12px] border border-admin-warning-soft-border bg-admin-warning-soft-bg px-4 py-3 text-[13px] text-admin-warning-text">
            <strong>
              Livro nº {settings.bookNumber} sem termo de abertura:
            </strong>{" "}
            &quot;Os livros previstos neste Capítulo serão abertos, numerados,
            autenticados e encerrados pelo delegatário&quot; (art. 186). Confira
            o número do livro e de folhas em Configurar e gere o termo de
            abertura em &quot;Gerar PDF do livro&quot;.
          </p>
        )}
        {duties.map((d) => (
          <p
            key={d.id}
            className={`rounded-[12px] border px-4 py-3 text-[13px] ${d.late ? "border-admin-error-border bg-admin-error-bg text-admin-error-text" : "border-admin-warning-soft-border bg-admin-warning-soft-bg text-admin-warning-text"}`}
          >
            <strong>
              {d.title}
              {d.late ? " (prazo vencido)" : ""}:
            </strong>{" "}
            {d.detail}
          </p>
        ))}
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
          {canBulletin && (
            <form action={sendMonthToBulletin} className="ml-auto">
              <input type="hidden" name="mes" value={month} />
              <button type="submit" className="btn btn-admin-secondary btn-sm">
                <AdminIcon name="upload" className="h-4 w-4" /> Enviar o mês ao
                boletim
              </button>
            </form>
          )}
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
              sum.balanceCents >= 0
                ? "Saldo líquido positivo"
                : "Saldo líquido negativo",
              m(Math.abs(sum.balanceCents)),
              "art. 192",
            ],
            [
              "Fundos e repasses",
              m(sum.fundsCents),
              `ISSQN ${m(sum.issCents)} · fora da receita (art. 190, § 3º)`,
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
                              : e.kind === "deposito"
                                ? `Depósito do excedente (art. 194, I): R$ ${formatMoneyBRL(e.amountCents)}`
                                : categoryLabel(e.category)}
                          </span>
                          <span className="block">
                            {e.actCode ? `${e.actCode} - ` : ""}
                            {e.description}
                            {e.quantity > 1 ? ` (${e.quantity} atos)` : ""}
                            {e.supplier ? ` · ${e.supplier}` : ""}
                            {e.documentRef
                              ? ` · ${e.kind === "deposito" ? "conta " : ""}${e.documentRef}`
                              : ""}
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
                    {r.kind === "abertura" || r.kind === "encerramento"
                      ? `livro nº ${snapshotOf(r).book?.number ?? 1}`
                      : r.kind === "dia"
                        ? brDate(r.periodStart)
                        : r.kind === "mes"
                          ? monthLabel(r.periodStart)
                          : r.periodStart.slice(0, 4)}
                  </Link>
                  {(() => {
                    const b = snapshotOf(r).book;
                    return b?.firstSheet && b.lastSheet ? (
                      <span className="text-[12px] text-admin-muted">
                        livro {b.number}, fls. {b.firstSheet}
                        {b.lastSheet !== b.firstSheet
                          ? ` a ${b.lastSheet}`
                          : ""}
                      </span>
                    ) : null;
                  })()}
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
