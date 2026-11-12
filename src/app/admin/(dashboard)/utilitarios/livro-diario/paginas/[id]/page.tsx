import { notFound } from "next/navigation";
import {
  annualTotals,
  BOOK_DOC_LABELS,
  type BookDocKind,
  brDate,
  defaultOficioAddressee,
  monthLabel,
  summarize,
} from "@/core/daily-book/book.ts";
import { formatMoneyBRL } from "@/core/transparency/bulletin.ts";
import { db } from "@/db/index.ts";
import { findBookReportWith, snapshotOf } from "@/lib/daily-book.ts";
import { getSecurityPaperSettingsWith } from "@/lib/security-paper.ts";
import { getGuideSettings } from "@/lib/tax-guides.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminIcon } from "../../../../../_components/icon.tsx";
import { AdminPageHeader } from "../../../../../_components/page-header.tsx";
import { SignOrPrint } from "../../../../../_components/sign-or-print.tsx";
import { buttonVariants } from "../../../../../_ui/button.tsx";
import { requireBookAccess } from "../../_lib/access.ts";
import {
  BalanceOficioForm,
  RemoveReportButton,
  ReportEditForm,
} from "../../forms.tsx";

export const metadata = { title: "Página do Livro Diário" };

export default async function BookPagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ gerado?: string; livro?: string }>;
}) {
  await requireBookAccess();
  const tenant = await getTenant();
  const row = await findBookReportWith(db, tenant.slug, (await params).id);
  if (!row) notFound();
  const s = snapshotOf(row);
  const query = await searchParams;
  const signers = (await getGuideSettings(tenant)).signers;
  const terms = s.kind === "abertura" || s.kind === "encerramento";
  const label = terms
    ? `livro nº ${s.book?.number ?? 1}`
    : s.kind === "dia"
      ? brDate(s.start)
      : s.kind === "mes"
        ? monthLabel(s.start)
        : s.start.slice(0, 4);
  const sheets =
    s.book?.firstSheet && s.book.lastSheet
      ? `Livro nº ${s.book.number}, ${s.book.firstSheet === s.book.lastSheet ? `folha ${s.book.firstSheet}` : `folhas ${s.book.firstSheet} a ${s.book.lastSheet}`}`
      : "";
  const title = `${BOOK_DOC_LABELS[s.kind as BookDocKind]}: ${label}`;
  const sum = summarize(s.entries);
  const revenue =
    s.kind === "ano"
      ? s.months.reduce((a, x) => a + x.revenueCents, 0)
      : sum.revenueCents;
  const expenses =
    s.kind === "ano"
      ? s.months.reduce((a, x) => a + x.expensesCents, 0)
      : sum.expensesCents;
  const pdf = `/admin/utilitarios/livro-diario/paginas/${row.id}/arquivo`;
  const annual = s.kind === "ano";
  const oficioPdf = `/admin/utilitarios/livro-diario/paginas/${row.id}/oficio`;
  const corregedoria = annual
    ? await getSecurityPaperSettingsWith(db, tenant)
    : null;
  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title={title}
        back={{
          href: `/admin/utilitarios/livro-diario?mes=${s.start.slice(0, 7)}`,
          label: "Livro Diário Auxiliar",
        }}
        description={
          terms
            ? `${BOOK_DOC_LABELS[s.kind as BookDocKind]}, ${s.book?.sheetCount ? `${s.book.sheetCount} folhas` : "número de folhas não informado"}`
            : `${sheets ? `${sheets} · ` : ""}Receita R$ ${formatMoneyBRL(revenue)} · despesa R$ ${formatMoneyBRL(expenses)} · saldo R$ ${formatMoneyBRL(revenue - expenses)}`
        }
      />
      <main className="flex max-w-[1000px] flex-col gap-4.5 px-4 py-7 md:px-8">
        {query.gerado && (
          <p className="rounded-lg bg-success-soft px-4 py-3 text-sm font-semibold text-success-text">
            Página gerada e guardada. Assine digitalmente ou imprima para
            assinar.
          </p>
        )}
        {query.livro === "cheio" && (
          <p className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-text">
            <strong>As folhas do livro nº {s.book?.number} acabaram:</strong>{" "}
            esta página vai até a folha {s.book?.lastSheet}, e o livro tem{" "}
            {s.book?.sheetCount}. Gere o termo de encerramento, passe para o
            livro seguinte em Configurar e gere o novo termo de abertura (art.
            186).
          </p>
        )}
        {row.removedAt && (
          <p className="rounded-lg bg-destructive-soft px-4 py-3 text-sm font-semibold text-destructive">
            Página excluída: {row.removeReason}
          </p>
        )}
        <section className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-5 py-4">
          <p className="mr-auto text-sm font-semibold text-foreground">
            {title}
          </p>
          <SignOrPrint
            pdfHref={pdf}
            title={`Livro Diário Auxiliar, ${title}`}
          />
          <a
            href={`${pdf}?formato=planilha`}
            className={buttonVariants({ variant: "outline" })}
          >
            <AdminIcon name="grid" className="h-4 w-4" /> Baixar planilha
          </a>
        </section>
        {annual && !row.removedAt && !annualTotals(s).detailed && (
          <p className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-text">
            Este balanço foi gerado antes das colunas de atos, arrecadação bruta
            e fundos e ISS. Para incluí-las, edite abaixo e marque "Refazer com
            os lançamentos de agora".
          </p>
        )}
        {annual && !row.removedAt && corregedoria && (
          <section className="flex flex-col gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Ofício de encaminhamento à Corregedoria
              </h2>
              <p className="text-xs text-muted-foreground">
                {tenant.location.state === "RN"
                  ? "O balanço é remetido à Corregedoria Geral de Justiça até 5 dias depois de sua conclusão (CGJ/RN art. 62). "
                  : ""}
                O ofício vai na primeira página, seguido do balanço.
              </p>
            </div>
            <BalanceOficioForm
              id={row.id}
              initial={{
                number: s.oficio?.number ?? "",
                addressee:
                  s.oficio?.addressee ?? defaultOficioAddressee(corregedoria),
                date: s.oficio?.date ?? s.issuedOn,
              }}
            />
            {s.oficio && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-5 py-4">
                <p className="mr-auto text-sm font-semibold text-foreground">
                  Ofício nº {s.oficio.number} com o balanço de{" "}
                  {s.start.slice(0, 4)}
                </p>
                <SignOrPrint
                  pdfHref={oficioPdf}
                  title={`Ofício nº ${s.oficio.number}, balanço anual de ${s.start.slice(0, 4)}`}
                />
              </div>
            )}
          </section>
        )}
        {!row.removedAt && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-foreground">Editar</h2>
              <RemoveReportButton id={row.id} />
            </div>
            <ReportEditForm
              id={row.id}
              signers={signers.map(({ name, title: t }) => ({
                name,
                title: t,
              }))}
              initial={{
                issuedOn: s.issuedOn,
                notes: s.notes,
                signer: row.signer,
              }}
            />
          </>
        )}
        <p className="text-xs text-muted-foreground">
          A página fica guardada como foi gerada. Correções nos lançamentos só
          entram nela se você marcar "Refazer com os lançamentos de agora".
          {sheets
            ? " Refeita, ela continua na mesma folha inicial; uma folha usada não é usada de novo, nem se a página for excluída (art. 186)."
            : ""}
        </p>
      </main>
    </>
  );
}
