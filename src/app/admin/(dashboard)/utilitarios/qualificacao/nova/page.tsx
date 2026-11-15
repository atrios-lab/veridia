import { emptyQualification } from "@/core/qualificacao/qualificacao.ts";
import { today } from "@/lib/tenant.ts";
import { BackLink } from "../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { requireQualificacao } from "../_access.ts";
import { NewQualificationForm } from "../qualificacao-forms.tsx";

export const metadata = { title: "Nova qualificação" };

export default async function NewQualificationPage() {
  await requireQualificacao();
  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title="Nova qualificação"
        description="Lance o título apresentado: quem apresentou, o que é e o ato pedido. As exigências vêm na tela seguinte, da biblioteca ou escritas."
      />
      <main className="flex max-w-[1000px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink
          href="/admin/utilitarios/qualificacao"
          label="Qualificação de títulos"
        />
        <NewQualificationForm initial={emptyQualification("rcpn", today())} />
      </main>
    </>
  );
}
