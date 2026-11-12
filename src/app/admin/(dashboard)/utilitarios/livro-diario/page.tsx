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
import {
  BOOK_TERMS_HELP,
  INTERIM_EXCESS_HELP,
  JUSTICA_ABERTA_HELP,
} from "../../../_components/screen-help.ts";
import { ScreenHelpButton } from "../../../_components/screen-help-button.tsx";
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../_ui/table.tsx";
import { monthPeriod, requireBookAccess } from "./_lib/access.ts";
import { sendMonthToBulletin } from "./actions.ts";
import { BookTermsPanel, RemoveEntryButton, ReportForm } from "./forms.tsx";

export const metadata = { title: "Livro Diário Auxiliar" };

const DONE: Record<string, string> = {
  importado: "Relatório lido e receitas lançadas no livro.",
  despesa: "Despesa lançada.",
  receita: "Receita lançada.",
  deposito: "Depósito lançado (art. 194, I).",
  editado: "Lançamento corrigido.",
  "pagina-excluida": "Página excluída. Ela continua guardada.",
};

const TH = "px-3 text-xs font-medium text-muted-foreground";
const TD = "px-3 py-2.5 align-top whitespace-normal text-foreground";
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
  const base = "/admin/utilitarios/livro-diario";
  // Art. 186: the current book's terms and the sheets it has used.
  const ofBook = reports.filter(
    (r) => snapshotOf(r).book?.number === settings.bookNumber,
  );
  const term = (kind: "abertura" | "encerramento") => {
    const row = ofBook.find((r) => r.kind === kind && !r.removedAt);
    return row
      ? { href: `${base}/paginas/${row.id}`, date: snapshotOf(row).issuedOn }
      : null;
  };
  const usedSheets = ofBook.reduce(
    (most, r) => Math.max(most, snapshotOf(r).book?.lastSheet ?? 0),
    0,
  );
  const live = rows.filter((r) => !r.removedAt).map(entryOf);
  const sum = summarize(live);
  const done = query.feito ? DONE[query.feito] : undefined;
  // Art. 191-A: the expenses of the month by its end. The last 5 days.
  const lastDays =
    month === now.slice(0, 7) &&
    Number(period.end.slice(8)) - Number(now.slice(8)) < 5;

  return (
    <>
      <AdminPageHeader
        maxWidth={1150}
        title="Livro Diário Auxiliar"
        description="Código Nacional de Normas (Provimento CNJ nº 149/2023, arts. 185 a 195-D, com a redação do Provimento CNJ nº 259/2026): termos de abertura e encerramento, receita por especialidade no dia do ato, despesas até o fim do mês, apuração mensal e balanço anual."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`${base}/importar`} className={buttonVariants()}>
              <AdminIcon name="upload" className="h-4 w-4" /> Anexar
              produtividade
            </Link>
            <Link
              href={`${base}/lancamento?tipo=despesa`}
              className={buttonVariants({ variant: "outline" })}
            >
              <AdminIcon name="plus" className="h-4 w-4" /> Lançar despesa
            </Link>
            <Link
              href={`${base}/lancamento?tipo=receita`}
              className={buttonVariants({ variant: "outline" })}
            >
              <AdminIcon name="plus" className="h-4 w-4" /> Lançar receita
            </Link>
            {settings.interim && (
              <Link
                href={`${base}/lancamento?tipo=deposito`}
                className={buttonVariants({ variant: "outline" })}
              >
                <AdminIcon name="plus" className="h-4 w-4" /> Depósito do
                excedente
              </Link>
            )}
          </div>
        }
      />
      <main className="flex max-w-[1150px] flex-col gap-5 px-4 py-7 md:px-8">
        {done && (
          <p className="rounded-lg bg-success-soft px-4 py-3 text-sm font-semibold text-success-text">
            {done}
          </p>
        )}
        {duties.map((d) => (
          <p
            key={d.id}
            className={`rounded-lg border px-4 py-3 text-sm ${d.late ? "border-destructive/40 bg-destructive-soft text-destructive" : "border-warning/30 bg-warning-soft text-warning-text"}`}
          >
            <strong>
              {d.title}
              {d.late ? " (prazo vencido)" : ""}:
            </strong>{" "}
            {d.detail}
            {d.id === "justica-aberta" && (
              <>
                {" "}
                <Link
                  href={`${base}/justica-aberta`}
                  className="font-semibold underline underline-offset-4"
                >
                  Abrir os dados prontos para o Justiça Aberta
                </Link>
              </>
            )}
          </p>
        ))}
        {lastDays && (
          <p className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-text">
            <strong>Fim do mês:</strong> as despesas de{" "}
            {monthLabel(period.start)} precisam estar lançadas até{" "}
            {brDate(period.end)} (art. 191-A), com o comprovante.
          </p>
        )}

        {/* Art. 186: the terms in plain sight (decision of 12/11/2026). */}
        <section className="rounded-xl border-2 border-primary bg-card px-5 py-4">
          <div className="mb-3 flex flex-wrap items-center gap-2.5">
            <h2 className="text-lg font-semibold text-foreground">
              Abertura e encerramento do livro nº {settings.bookNumber}
            </h2>
            <ScreenHelpButton
              help={BOOK_TERMS_HELP}
              canConfigure
              label="O que são os termos de abertura e de encerramento"
            />
            {!term("abertura") && (
              <span className="rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-warning-text">
                Livro ainda não aberto
              </span>
            )}
          </div>
          <BookTermsPanel
            bookNumber={settings.bookNumber}
            sheetCount={settings.sheetCount}
            usedSheets={usedSheets}
            opening={term("abertura")}
            closing={term("encerramento")}
            today={now}
          />
        </section>

        <section className="flex flex-wrap items-center gap-4 rounded-xl border-2 border-primary bg-card px-5 py-4">
          <div className="flex min-w-[260px] flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-semibold text-foreground">
                Calculadora do excedente do interino
              </h2>
              <ScreenHelpButton
                help={INTERIM_EXCESS_HELP}
                canConfigure
                label="O que é o excedente de 90,25% do STF, com exemplos"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Para serventia vaga: calcula quanto da renda líquida ultrapassa
              90,25% do subsídio de ministro do STF e deve ser depositado à
              disposição do Tribunal de Justiça (art. 194).
            </p>
          </div>
          <Link href={`${base}/excedente`} className={buttonVariants()}>
            <AdminIcon name="grid" className="h-4 w-4" /> Abrir a calculadora
          </Link>
        </section>

        <section className="flex flex-wrap items-center gap-4 rounded-xl border-2 border-primary bg-card px-5 py-4">
          <div className="flex min-w-[260px] flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-semibold text-foreground">
                Justiça Aberta: dados do semestre
              </h2>
              <ScreenHelpButton
                help={JUSTICA_ABERTA_HELP}
                canConfigure
                label="Como copiar os dados para o Justiça Aberta"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Atos, receitas por especialidade, despesas e resultado, na ordem
              do formulário do CNJ, prontos para copiar, com o repasse do
              FCRCPN. Até 15 de janeiro e 15 de julho (Provimento CNJ nº
              24/2012, art. 2º).
            </p>
          </div>
          <Link href={`${base}/justica-aberta`} className={buttonVariants()}>
            <AdminIcon name="grid" className="h-4 w-4" /> Abrir o Justiça Aberta
          </Link>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`${base}?mes=${shiftMonth(month, -1)}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            ‹ Mês anterior
          </Link>
          <h2 className="text-xl font-semibold text-foreground">
            {monthLabel(period.start).charAt(0).toUpperCase()}
            {monthLabel(period.start).slice(1)}
          </h2>
          <Link
            href={`${base}?mes=${shiftMonth(month, 1)}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Próximo mês ›
          </Link>
          {canBulletin && (
            <form action={sendMonthToBulletin} className="ml-auto">
              <input type="hidden" name="mes" value={month} />
              <Button type="submit" variant="outline" size="sm">
                <AdminIcon name="upload" className="h-4 w-4" /> Enviar o mês ao
                boletim
              </Button>
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
            <div key={label} className="rounded-xl border bg-card px-5 py-4">
              <p className="text-xs font-medium text-muted-foreground">
                {label}
              </p>
              <p className="text-2xl font-semibold text-foreground tabular-nums">
                {value}
              </p>
              <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5">
            <h2 className="text-lg font-semibold text-foreground">
              Lançamentos do mês
            </h2>
            <Link
              href={`${base}?mes=${month}${showRemoved ? "" : "&excluidos=1"}`}
              className="text-xs font-semibold text-primary underline"
            >
              {showRemoved
                ? "Esconder os excluídos"
                : "Mostrar também os excluídos"}
            </Link>
          </div>
          {rows.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">
              Nenhum lançamento neste mês. Comece em{" "}
              <strong>Anexar produtividade</strong> (as receitas) e{" "}
              <strong>Lançar despesa</strong>.
            </p>
          ) : (
            <Table className="min-w-[860px]">
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className={TH}>Data</TableHead>
                  <TableHead className={TH}>Discriminação</TableHead>
                  <TableHead className={`${TH} text-right`}>Receita</TableHead>
                  <TableHead className={`${TH} text-right`}>Despesa</TableHead>
                  <TableHead className={TH}>
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const e = entryOf(row);
                  const removed = row.removedAt !== null;
                  return (
                    <TableRow
                      key={row.id}
                      className={removed ? "opacity-55" : ""}
                    >
                      <TableCell className={`${TD} tabular-nums`}>
                        {brDate(e.date)}
                      </TableCell>
                      <TableCell className={TD}>
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
                          <span className="block text-xs text-muted-foreground">
                            {e.fiscalDistinct
                              ? "Tratamento fiscal distinto. "
                              : ""}
                            {e.explanation}
                          </span>
                        )}
                        {removed && (
                          <span className="block text-xs text-muted-foreground">
                            Excluído: {row.removeReason}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className={`${TD} text-right tabular-nums`}>
                        {e.kind === "receita"
                          ? formatMoneyBRL(e.amountCents)
                          : ""}
                      </TableCell>
                      <TableCell className={`${TD} text-right tabular-nums`}>
                        {e.kind === "despesa"
                          ? formatMoneyBRL(e.amountCents)
                          : ""}
                      </TableCell>
                      <TableCell className={`${TD} text-right`}>
                        {!removed && (
                          <span className="inline-flex flex-wrap justify-end gap-1.5">
                            {e.hasAttachment && (
                              <a
                                href={`${base}/lancamento/${row.id}/comprovante`}
                                target="_blank"
                                rel="noreferrer"
                                className={buttonVariants({
                                  variant: "outline",
                                  size: "sm",
                                })}
                              >
                                Comprovante
                              </a>
                            )}
                            <Link
                              href={`${base}/lancamento?id=${row.id}`}
                              className={buttonVariants({
                                variant: "outline",
                                size: "sm",
                              })}
                            >
                              Editar
                            </Link>
                            <RemoveEntryButton id={row.id} />
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            Gerar PDF do livro
          </h2>
          <ReportForm
            today={now}
            month={month}
            signers={guide.signers.map(({ name, title }) => ({ name, title }))}
          />
        </section>

        <section className="overflow-hidden rounded-xl border bg-card">
          <h2 className="border-b px-5 py-3.5 text-lg font-semibold text-foreground">
            Páginas geradas
          </h2>
          {reports.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">
              Nenhuma página gerada ainda.
            </p>
          ) : (
            <ul>
              {reports.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 border-b px-5 py-3 last:border-0"
                >
                  <Link
                    href={`${base}/paginas/${r.id}`}
                    className="mr-auto text-sm font-semibold text-primary underline"
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
                      <span className="text-xs text-muted-foreground">
                        livro {b.number}, fls. {b.firstSheet}
                        {b.lastSheet !== b.firstSheet
                          ? ` a ${b.lastSheet}`
                          : ""}
                      </span>
                    ) : null;
                  })()}
                  <span className="text-xs text-muted-foreground">
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
