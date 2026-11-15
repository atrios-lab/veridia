import { BackLink } from "../../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../../_components/page-header.tsx";
import { requireCtp } from "../../../titularidade/_access.ts";
import { TransferForm } from "../../../titularidade/titularidade-forms.tsx";

export const metadata = { title: "Lançar escritura para a Carga CTP" };

export default async function NewCtpPage() {
  await requireCtp();
  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title="Lançar escritura"
        description="Anexe o traslado da escritura que transmitiu imóvel: o sistema lê e preenche a ficha da CTP. Confira e salve. O arquivo não fica guardado."
      />
      <main className="flex max-w-[1000px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink href="/admin/utilitarios/censec/ctp" label="Carga CTP" />
        <TransferForm
          values={{ service: "notas", act: "escritura" }}
          back="ctp"
        />
      </main>
    </>
  );
}
