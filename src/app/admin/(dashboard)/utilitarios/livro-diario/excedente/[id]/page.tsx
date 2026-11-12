import { notFound } from "next/navigation";
import { brDate } from "@/core/daily-book/book.ts";
import { computeExcess } from "@/core/daily-book/excess-calc.ts";
import { formatMoneyBRL } from "@/core/transparency/bulletin.ts";
import { db } from "@/db/index.ts";
import { findExcessWith } from "@/lib/daily-book-excess.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../../../_components/page-header.tsx";
import { SignOrPrint } from "../../../../../_components/sign-or-print.tsx";
import { requireBookAccess } from "../../_lib/access.ts";
import { ExcessForm, RemoveExcessButton } from "../forms.tsx";

export const metadata = { title: "Cálculo do excedente" };

export default async function ExcessCalcPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ salvo?: string }>;
}) {
  await requireBookAccess();
  const tenant = await getTenant();
  const calc = await findExcessWith(db, tenant.slug, (await params).id);
  if (!calc) notFound();
  const query = await searchParams;
  const r = computeExcess(calc);
  const period = `${brDate(calc.start)} a ${brDate(calc.end)}`;
  const pdf = `/admin/utilitarios/livro-diario/excedente/${calc.id}/arquivo`;
  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title={`Excedente: ${period}`}
        back={{
          href: "/admin/utilitarios/livro-diario/excedente",
          label: "Excedente do interino",
        }}
        description={`Renda líquida R$ ${formatMoneyBRL(Math.max(0, r.netCents))} · teto do período R$ ${formatMoneyBRL(r.limitCents)} · excedente R$ ${formatMoneyBRL(r.excessCents)}`}
      />
      <main className="flex max-w-[1000px] flex-col gap-4.5 px-[30px] py-7 max-md:px-4">
        {query.salvo && (
          <p className="rounded-[12px] bg-admin-success-bg px-4 py-3 text-[13px] font-semibold text-admin-success-text">
            {query.salvo === "editado"
              ? "Cálculo alterado. O PDF já sai com a alteração."
              : "Cálculo salvo. Assine digitalmente ou imprima para assinar à mão."}
          </p>
        )}
        {calc.removedAt && (
          <p className="rounded-[12px] bg-admin-error-bg px-4 py-3 text-[13px] font-semibold text-admin-error-text">
            Cálculo excluído: {calc.removeReason}
          </p>
        )}
        <section className="flex flex-wrap items-center gap-3 rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <p className="mr-auto text-[13px] font-bold text-admin-primary">
            Memória de cálculo do excedente, {period}
          </p>
          <SignOrPrint
            pdfHref={pdf}
            title={`Memória de cálculo do excedente do interino, ${period}`}
          />
        </section>
        {!calc.removedAt && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
                Editar
              </h2>
              <RemoveExcessButton id={calc.id} />
            </div>
            <ExcessForm
              initial={{
                id: calc.id,
                period: calc.period,
                start: calc.start,
                subsidy: formatMoneyBRL(calc.subsidyCents),
                revenue: formatMoneyBRL(calc.revenueCents),
                expenses: formatMoneyBRL(calc.expensesCents),
                notes: calc.notes,
              }}
            />
          </>
        )}
      </main>
    </>
  );
}
