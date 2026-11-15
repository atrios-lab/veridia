import { BackLink } from "../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { requireDoi } from "../../titularidade/_access.ts";
import { TransferForm } from "../../titularidade/titularidade-forms.tsx";

export const metadata = { title: "Lançar escritura ou registro para a DOI" };

export default async function NewDoiPage() {
  await requireDoi();
  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title="Lançar escritura ou registro"
        description="Anexe o traslado da escritura ou a certidão do registro: o sistema lê e preenche a DOI (operação, imóvel, valores, partes, forma de pagamento). Confira e salve. O arquivo não fica guardado."
      />
      <main className="flex max-w-[1000px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink href="/admin/utilitarios/doi" label="Carga da DOI" />
        <TransferForm
          values={{ service: "notas", act: "escritura" }}
          back="doi"
        />
      </main>
    </>
  );
}
