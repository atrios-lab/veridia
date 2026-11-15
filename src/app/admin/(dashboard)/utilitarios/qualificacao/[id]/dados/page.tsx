import { notFound } from "next/navigation";
import { db } from "@/db/index.ts";
import { getQualificationWith, listNotesWith } from "@/lib/qualificacao.ts";
import { getTenant } from "@/lib/tenant.ts";
import { BackLink } from "../../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../../_components/page-header.tsx";
import { requireQualificacao } from "../../_access.ts";
import { PresentationForm } from "../../qualificacao-forms.tsx";

export const metadata = { title: "Alterar a qualificação" };

export default async function EditPresentationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireQualificacao();
  const { id } = await params;
  const tenant = await getTenant();
  const q = await getQualificationWith(db, tenant.slug, id);
  if (!q || q.removedAt) notFound();
  const notes = await listNotesWith(db, tenant.slug, q.id);
  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title="Alterar a qualificação"
        description="Dados da apresentação, fundamentos gerais e observações. Notas já emitidas não mudam: valem para as próximas."
      />
      <main className="flex max-w-[1000px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink
          href={`/admin/utilitarios/qualificacao/${q.id}`}
          label="Voltar à qualificação"
        />
        <PresentationForm
          id={q.id}
          initial={q.data}
          issued={notes.some((n) => !n.removedAt)}
        />
      </main>
    </>
  );
}
