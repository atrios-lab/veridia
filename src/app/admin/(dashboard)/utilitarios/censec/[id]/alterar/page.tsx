import { notFound } from "next/navigation";
import { actToForm } from "@/core/censec/form.ts";
import { db } from "@/db/index.ts";
import { getCensecActWith } from "@/lib/censec.ts";
import { getTenant } from "@/lib/tenant.ts";
import { BackLink } from "../../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../../_components/page-header.tsx";
import { requireCensec } from "../../_access.ts";
import { ActForm } from "../../censec-forms.tsx";

export const metadata = { title: "Editar ato da CENSEC" };

export default async function EditActPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCensec();
  const tenant = await getTenant();
  const found = await getCensecActWith(db, tenant.slug, (await params).id);
  if (!found) notFound();
  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title="Editar ato"
        description="Confira com o documento e complete o que falta. Tudo é editável; a alteração vai para a auditoria com a justificativa."
      />
      <main className="flex max-w-[1000px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink
          href={`/admin/utilitarios/censec?q=${found.quinzena}`}
          label="Cargas da CENSEC"
        />
        <ActForm
          id={found.id}
          values={actToForm(found.act)}
          quinzena={found.quinzena}
        />
      </main>
    </>
  );
}
