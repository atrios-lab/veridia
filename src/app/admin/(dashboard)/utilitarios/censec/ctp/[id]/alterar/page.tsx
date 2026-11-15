import { notFound } from "next/navigation";
import {
  competenceOf,
  transferToForm,
} from "@/core/titularidade/titularidade.ts";
import { db } from "@/db/index.ts";
import { getTenant } from "@/lib/tenant.ts";
import { getTransferWith } from "@/lib/title-transfers.ts";
import { BackLink } from "../../../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../../../_components/page-header.tsx";
import { requireCtp } from "../../../../titularidade/_access.ts";
import { TransferForm } from "../../../../titularidade/titularidade-forms.tsx";

export const metadata = { title: "Editar o ato da Carga CTP" };

export default async function EditCtpPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCtp();
  const tenant = await getTenant();
  const found = await getTransferWith(db, tenant.slug, (await params).id);
  if (!found) notFound();
  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title="Editar o ato da Carga CTP"
        description="Complete o que o CENSEC pede e a escritura não trouxe. A alteração vale também para o ofício à prefeitura e para a DOI, e vai para a auditoria com a justificativa."
      />
      <main className="flex max-w-[1000px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink
          href={`/admin/utilitarios/censec/ctp?mes=${competenceOf(found.transfer.actDate)}`}
          label="Carga CTP"
        />
        <TransferForm
          id={found.id}
          values={transferToForm(found.transfer)}
          back="ctp"
        />
      </main>
    </>
  );
}
