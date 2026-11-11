import { notFound } from "next/navigation";
import { categoryLabel, EXPENSE_CATEGORIES } from "@/core/daily-book/book.ts";
import { formatMoneyBRL } from "@/core/transparency/bulletin.ts";
import { db } from "@/db/index.ts";
import { findEntryWith, getBookSettingsWith } from "@/lib/daily-book.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { requireBookAccess } from "../_lib/access.ts";
import { EntryForm, RemoveEntryButton } from "../forms.tsx";

export const metadata = { title: "Lançamento do Livro Diário" };

export default async function EntryPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; id?: string }>;
}) {
  await requireBookAccess();
  const tenant = await getTenant();
  const query = await searchParams;
  const settings = await getBookSettingsWith(db, tenant.slug);
  const row = query.id
    ? await findEntryWith(db, tenant.slug, query.id)
    : undefined;
  if (query.id && (!row || row.removedAt)) notFound();
  const now = today();
  const kind = row
    ? row.kind === "despesa"
      ? "despesa"
      : "receita"
    : query.tipo === "receita"
      ? "receita"
      : "despesa";
  return (
    <>
      <AdminPageHeader
        title={
          row
            ? "Editar lançamento"
            : kind === "despesa"
              ? "Lançar despesa"
              : "Lançar receita"
        }
        back={{
          href: `/admin/utilitarios/livro-diario?mes=${(row?.occurredOn ?? now).slice(0, 7)}`,
          label: "Livro Diário Auxiliar",
        }}
        description={
          kind === "despesa"
            ? "Toda despesa do serviço, até o fim do mês em que foi paga, com o comprovante (art. 191-A)."
            : "Receita que não veio no relatório de produtividade, lançada no dia do ato (art. 190)."
        }
        actions={row ? <RemoveEntryButton id={row.id} /> : undefined}
      />
      <main className="flex max-w-[1000px] flex-col gap-4 px-[30px] py-7 max-md:px-4">
        <EntryForm
          today={now}
          interim={settings.interim}
          categories={EXPENSE_CATEGORIES.filter(
            // The interim's pay only where an interim runs the office.
            (c) =>
              c.id !== "interino" ||
              settings.interim ||
              row?.category === "interino",
          ).map((c) => ({
            id: c.id,
            label: categoryLabel(c.id),
          }))}
          specialties={settings.specialties.map((s) => s.name)}
          initial={{
            id: row?.id,
            kind,
            date: row?.occurredOn ?? now,
            specialty: row?.specialty ?? "",
            category: row?.category ?? "",
            actCode: row?.actCode ?? "",
            description: row?.description ?? "",
            quantity: row?.quantity ?? 1,
            amount: row ? formatMoneyBRL(row.amountCents) : "",
            supplier: row?.supplier ?? "",
            documentRef: row?.documentRef ?? "",
            fiscalDistinct: row?.fiscalDistinct ?? false,
            fiscalNote: row?.fiscalNote ?? "",
            explanation: row?.explanation ?? "",
            attachmentName: row?.attachmentName,
          }}
        />
      </main>
    </>
  );
}
