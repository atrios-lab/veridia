import { notFound } from "next/navigation";
import { fichaFields, fichaValue } from "@/core/rcpn/ficha.ts";
import { RCPN_KIND_LABELS } from "@/core/rcpn/record.ts";
import { ficha as fichas } from "@/lib/rcpn-ficha.ts";
import { getTenant } from "@/lib/tenant.ts";
import { BackLink } from "../../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../../_components/page-header.tsx";
import { requireRcpn } from "../../../_lib/access.ts";
import { FichaForm } from "../../ficha-forms.tsx";

export const metadata = { title: "Alterar registro" };

export default async function AlterRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRcpn("rcpn.edit");
  const tenant = await getTenant();
  const found = await fichas.get(tenant.slug, (await params).id);
  if (!found || found.canceledAt) notFound();
  const { record } = found;
  const values = Object.fromEntries(
    fichaFields(record.kind).map((f) => [f.key, fichaValue(record, f.key)]),
  );
  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title={`Alterar ${RCPN_KIND_LABELS[record.kind].toLowerCase()}: ${record.people.map((p) => p.name).join(" e ")}`}
        description="Corrija o que estiver diferente do termo no livro. Cada campo alterado fica no histórico da ficha, com a justificativa."
      />
      <main className="flex max-w-[1000px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink
          href={`/admin/rcpn/registro/${record.id}`}
          label="Ficha do registro"
        />
        <FichaForm id={record.id} kind={record.kind} values={values} />
      </main>
    </>
  );
}
