import { notFound } from "next/navigation";
import { habilitacoes } from "@/lib/rcpn-habilitacao.ts";
import { getTenant } from "@/lib/tenant.ts";
import { BackLink } from "../../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../../_components/page-header.tsx";
import { requireRcpn } from "../../../_lib/access.ts";
import { HabilitacaoForm } from "../../habilitacao-forms.tsx";

export const metadata = { title: "Alterar habilitação" };

export default async function AlterHabilitacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRcpn("rcpn.habilitacao");
  const tenant = await getTenant();
  const found = await habilitacoes.get(tenant.slug, (await params).id);
  if (!found || found.canceledAt) notFound();
  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title={`Alterar processo ${found.number}`}
        description="Tudo pode ser corrigido. Cada campo alterado fica no histórico do processo, com a justificativa."
      />
      <main className="flex max-w-[1000px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink
          href={`/admin/rcpn/habilitacao/${found.id}`}
          label={`Processo ${found.number}`}
        />
        <HabilitacaoForm id={found.id} values={found.values} />
      </main>
    </>
  );
}
