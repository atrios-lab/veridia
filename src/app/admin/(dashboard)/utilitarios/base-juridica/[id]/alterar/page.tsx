import { notFound } from "next/navigation";
import { db } from "@/db/index.ts";
import {
  getRequestWith,
  getSourceWith,
  sourceMarkdown,
} from "@/lib/knowledge.ts";
import { getTenant } from "@/lib/tenant.ts";
import { BackLink } from "../../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../../_components/page-header.tsx";
import { requireKnowledge } from "../../_access.ts";
import { EditMetaForm, ReplaceForm } from "../../knowledge-forms.tsx";

export const metadata = { title: "Alterar fonte da base jurídica" };

export default async function EditSourcePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pedido?: string }>;
}) {
  await requireKnowledge();
  const { id } = await params;
  const { pedido } = await searchParams;
  const tenant = await getTenant();
  const [source, request] = await Promise.all([
    getSourceWith(db, tenant.slug, id),
    pedido ? getRequestWith(db, tenant.slug, pedido) : Promise.resolve(null),
  ]);
  if (!source || source.removedAt || source.meta.replacedBy) notFound();
  const open = request?.status === "open" ? request : null;

  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title={`Alterar: ${source.meta.title}`}
      />
      <main className="flex max-w-[1000px] flex-col gap-6 px-4 py-7 md:px-8">
        <BackLink
          href={`/admin/utilitarios/base-juridica/${source.id}`}
          label="Voltar à fonte"
        />
        {open && (
          <p className="rounded-xl border border-warning/30 bg-warning-soft px-5 py-3 text-sm text-foreground">
            Respondendo ao pedido da IA: {open.topic} Envie abaixo o documento
            atualizado.
          </p>
        )}
        <div id="trocar">
          <ReplaceForm
            id={source.id}
            markdown={sourceMarkdown(source)}
            request={open?.id}
          />
        </div>
        <EditMetaForm id={source.id} meta={source.meta} />
      </main>
    </>
  );
}
