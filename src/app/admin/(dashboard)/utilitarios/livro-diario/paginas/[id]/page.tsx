import { notFound } from "next/navigation";
import {
  BOOK_DOC_LABELS,
  type BookDocKind,
  brDate,
  monthLabel,
  summarize,
} from "@/core/daily-book/book.ts";
import { formatMoneyBRL } from "@/core/transparency/bulletin.ts";
import { db } from "@/db/index.ts";
import { findBookReportWith, snapshotOf } from "@/lib/daily-book.ts";
import { getGuideSettings } from "@/lib/tax-guides.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminIcon } from "../../../../../_components/icon.tsx";
import { AdminPageHeader } from "../../../../../_components/page-header.tsx";
import { SignOrPrint } from "../../../../../_components/sign-or-print.tsx";
import { requireBookAccess } from "../../_lib/access.ts";
import { RemoveReportButton, ReportEditForm } from "../../forms.tsx";

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
      <main className="flex max-w-[1000px] flex-col gap-4.5 px-[30px] py-7 max-md:px-4">
        {query.gerado && (
          <p className="rounded-[12px] bg-admin-success-bg px-4 py-3 text-[13px] font-semibold text-admin-success-text">
            Página gerada e guardada. Assine digitalmente ou imprima para
            assinar.
          </p>
        )}
        {query.livro === "cheio" && (
          <p className="rounded-[12px] border border-admin-warning-soft-border bg-admin-warning-soft-bg px-4 py-3 text-[13px] text-admin-warning-text">
            <strong>As folhas do livro nº {s.book?.number} acabaram:</strong>{" "}
            esta página vai até a folha {s.book?.lastSheet}, e o livro tem{" "}
            {s.book?.sheetCount}. Gere o termo de encerramento, passe para o
            livro seguinte em Configurar e gere o novo termo de abertura (art.
            186).
          </p>
        )}
        {row.removedAt && (
          <p className="rounded-[12px] bg-admin-error-bg px-4 py-3 text-[13px] font-semibold text-admin-error-text">
            Página excluída: {row.removeReason}
          </p>
        )}
        <section className="flex flex-wrap items-center gap-3 rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <p className="mr-auto text-[13px] font-bold text-admin-primary">
            {title}
          </p>
          <SignOrPrint
            pdfHref={pdf}
            title={`Livro Diário Auxiliar, ${title}`}
          />
          <a
            href={`${pdf}?formato=planilha`}
            className="btn btn-admin-secondary btn-md"
          >
            <AdminIcon name="grid" className="h-4 w-4" /> Baixar planilha
          </a>
        </section>
        {!row.removedAt && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
                Editar
              </h2>
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
        <p className="text-[12px] text-admin-muted">
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
