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
  const asked = row?.kind ?? query.tipo;
  const kind: "receita" | "despesa" | "deposito" =
    asked === "receita" || asked === "deposito" ? asked : "despesa";
  return (
    <>
      <AdminPageHeader
        title={
          row
            ? "Editar lançamento"
            : kind === "despesa"
              ? "Lançar despesa"
              : kind === "deposito"
                ? "Lançar depósito do excedente"
                : "Lançar receita"
        }
        back={{
          href: `/admin/utilitarios/livro-diario?mes=${(row?.occurredOn ?? now).slice(0, 7)}`,
          label: "Livro Diário Auxiliar",
        }}
        description={
          kind === "despesa"
            ? '"As despesas serão escrituradas no Livro Diário Auxiliar até o encerramento do mês em que se efetivarem, com indicação da respectiva data e dos elementos necessários à sua identificação e comprovação" (art. 191-A).'
            : kind === "deposito"
              ? 'Os responsáveis interinamente por delegações vagas "lançarão, no Livro Diário Auxiliar, o valor da renda líquida excedente a 90,25% dos subsídios de ministro do Supremo Tribunal Federal (STF) que depositarem à disposição do Tribunal de Justiça correspondente, indicando a data do depósito e a conta em que foi realizado" (art. 194, I).'
              : '"A receita será lançada no Livro Diário Auxiliar separadamente, por especialidade, de forma individualizada, no dia da prática do ato" (art. 190).'
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
