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
import { requireDoi } from "../../../titularidade/_access.ts";
import { TransferForm } from "../../../titularidade/titularidade-forms.tsx";

export const metadata = { title: "Editar a DOI do ato" };

export default async function EditDoiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireDoi();
  const tenant = await getTenant();
  const found = await getTransferWith(db, tenant.slug, (await params).id);
  if (!found) notFound();
  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title="Editar a DOI do ato"
        description="Complete o que a DOI pede e o título não trouxe. A alteração vale também para a comunicação à prefeitura e vai para a auditoria com a justificativa."
      />
      <main className="flex max-w-[1000px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink
          href={`/admin/utilitarios/doi?mes=${competenceOf(found.transfer.actDate)}`}
          label="Carga da DOI"
        />
        <TransferForm
          id={found.id}
          values={transferToForm(found.transfer)}
          back="doi"
        />
      </main>
    </>
  );
}
