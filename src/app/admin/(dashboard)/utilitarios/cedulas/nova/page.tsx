import { findById, listAttachments } from "@/lib/service-request.ts";
import { getTenant } from "@/lib/tenant.ts";
import { BackLink } from "../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { requireCedulas } from "../_access.ts";
import { NewAnalysisForm } from "../cedula-forms.tsx";

export const metadata = { title: "Nova análise de cédula" };

export default async function NewCedulaPage({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string }>;
}) {
  await requireCedulas();
  const { pedido } = await searchParams;
  const tenant = await getTenant();
  // From a pedido: its files come marked, and the analysis is linked.
  const request =
    pedido && /^[0-9a-f-]{36}$/i.test(pedido)
      ? await findById(tenant.slug, pedido)
      : null;
  const attachments = request
    ? (await listAttachments(tenant.slug, request.id))
        .filter((a) => a.path && !a.purgedAt)
        .map((a) => ({ id: a.id, name: a.displayName }))
    : [];
  return (
    <>
      <AdminPageHeader
        maxWidth={900}
        title="Nova análise de cédula"
        description="Anexe a cédula e os aditivos. O sistema lê, descobre a espécie e o livro, preenche os dados e sugere os atos e os modelos. Os arquivos são descartados depois da leitura."
      />
      <main className="flex max-w-[900px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink
          href={
            request
              ? `/admin/pedidos/${request.protocolNumber}`
              : "/admin/utilitarios/cedulas"
          }
          label={
            request
              ? `Voltar ao pedido ${request.protocolNumber}`
              : "Análise de cédulas"
          }
        />
        <NewAnalysisForm
          requestId={request?.id}
          protocol={request?.protocolNumber}
          attachments={attachments}
        />
      </main>
    </>
  );
}
