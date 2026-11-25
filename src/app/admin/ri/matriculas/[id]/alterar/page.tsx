import { notFound } from "next/navigation";
import { cnsDigits } from "@/core/ri/cnm.ts";
import { propertyTitle } from "@/core/ri/property.ts";
import { db } from "@/db/index.ts";
import { propertyDetailWith } from "@/lib/ri.ts";
import { RiPage } from "../../../_components/page.tsx";
import { PropertyForm } from "../../../_components/property-form.tsx";
import { requireRi } from "../../../_lib.ts";

export const metadata = { title: "Alterar matrícula" };

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenant } = await requireRi("ri.edit");
  const { id } = await params;
  const detail = await propertyDetailWith(db, tenant.slug, id);
  if (!detail || detail.property.deletedAt) notFound();
  const p = detail.property;
  return (
    <RiPage
      title={`Alterar ${propertyTitle(p)}`}
      description="O que era antes fica guardado no histórico da matrícula e na auditoria."
      back={{ href: `/admin/ri/matriculas/${id}`, label: propertyTitle(p) }}
    >
      <PropertyForm
        cns={cnsDigits(tenant.cns) ?? tenant.cns}
        property={p}
        id={id}
      />
    </RiPage>
  );
}
