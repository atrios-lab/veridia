import { notFound } from "next/navigation";
import {
  competenceOf,
  transferToForm,
} from "@/core/titularidade/titularidade.ts";
import { db } from "@/db/index.ts";
import { getTenant } from "@/lib/tenant.ts";
import { getTransferWith } from "@/lib/title-transfers.ts";
import { BackLink } from "../../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../../_components/page-header.tsx";
import { requireTitularidade } from "../../_access.ts";
import { TransferForm } from "../../titularidade-forms.tsx";

export const metadata = { title: "Alterar ato" };

export default async function AlterTransferPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTitularidade();
  const tenant = await getTenant();
  const found = await getTransferWith(db, tenant.slug, (await params).id);
  if (!found) notFound();
  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title="Alterar ato"
        description="Corrija o que estiver diferente do título. A alteração vai para a auditoria com a justificativa."
      />
      <main className="flex max-w-[1000px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink
          href={`/admin/utilitarios/titularidade?mes=${competenceOf(found.transfer.actDate)}`}
          label="Titularidade à prefeitura"
        />
        <TransferForm id={found.id} values={transferToForm(found.transfer)} />
      </main>
    </>
  );
}
