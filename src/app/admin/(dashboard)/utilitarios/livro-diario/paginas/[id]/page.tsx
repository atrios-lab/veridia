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
  searchParams: Promise<{ gerado?: string }>;
}) {
  await requireBookAccess();
  const tenant = await getTenant();
  const row = await findBookReportWith(db, tenant.slug, (await params).id);
  if (!row) notFound();
  const s = snapshotOf(row);
  const query = await searchParams;
  const signers = (await getGuideSettings(tenant)).signers;
  const label =
    s.kind === "dia"
      ? brDate(s.start)
      : s.kind === "mes"
        ? monthLabel(s.start)
        : s.start.slice(0, 4);
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
        title={title}
        back={{
          href: `/admin/utilitarios/livro-diario?mes=${s.start.slice(0, 7)}`,
          label: "Livro Diário Auxiliar",
        }}
        description={`Receita R$ ${formatMoneyBRL(revenue)} · despesa R$ ${formatMoneyBRL(expenses)} · saldo R$ ${formatMoneyBRL(revenue - expenses)}`}
      />
      <main className="flex max-w-[1000px] flex-col gap-4.5 px-[30px] py-7 max-md:px-4">
        {query.gerado && (
          <p className="rounded-[12px] bg-admin-success-bg px-4 py-3 text-[13px] font-semibold text-admin-success-text">
            Página gerada e guardada. Assine digitalmente ou imprima para
            assinar.
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
        </p>
      </main>
    </>
  );
}
