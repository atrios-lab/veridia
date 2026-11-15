import { notFound } from "next/navigation";
import { db } from "@/db/index.ts";
import { getLibraryItemWith } from "@/lib/qualificacao.ts";
import { getTenant } from "@/lib/tenant.ts";
import { BackLink } from "../../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../../_components/page-header.tsx";
import { requireQualificacao } from "../../_access.ts";
import { LibraryItemForm } from "../../qualificacao-forms.tsx";

export const metadata = { title: "Alterar exigência" };

export default async function EditLibraryItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireQualificacao();
  const { id } = await params;
  const tenant = await getTenant();
  const item = await getLibraryItemWith(db, tenant.slug, id);
  if (!item || item.removedAt) notFound();
  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title="Alterar exigência"
        description="A alteração vale para as próximas qualificações; as notas já emitidas não mudam."
      />
      <main className="flex max-w-[1000px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink
          href={`/admin/utilitarios/qualificacao/biblioteca?atribuicao=${item.attribution}`}
          label="Biblioteca de exigências"
        />
        <LibraryItemForm item={item} />
      </main>
    </>
  );
}
