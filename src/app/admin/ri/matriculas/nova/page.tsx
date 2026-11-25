import { cnsDigits } from "@/core/ri/cnm.ts";
import { RiPage } from "../../_components/page.tsx";
import { PropertyForm } from "../../_components/property-form.tsx";
import { requireRi } from "../../_lib.ts";

export const metadata = { title: "Nova matrícula" };

export default async function NewPropertyPage() {
  const { tenant } = await requireRi("ri.edit");
  return (
    <RiPage
      title="Nova matrícula"
      description="Os dados da ficha. Os proprietários e os ônus entram pelos atos, na tela da matrícula, depois de salvar."
      back={{ href: "/admin/ri/matriculas", label: "Matrículas" }}
    >
      <PropertyForm cns={cnsDigits(tenant.cns) ?? tenant.cns} />
    </RiPage>
  );
}
