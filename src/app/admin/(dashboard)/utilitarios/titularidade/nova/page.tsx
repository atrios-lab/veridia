import { BackLink } from "../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { requireTitularidade } from "../_access.ts";
import { TransferForm } from "../titularidade-forms.tsx";

export const metadata = { title: "Lançar escritura ou registro" };

export default async function NewTransferPage() {
  await requireTitularidade();
  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title="Lançar escritura ou registro"
        description="Envie o documento para o sistema ler, confira os campos e salve. O ato entra na comunicação do mês em que foi praticado."
      />
      <main className="flex max-w-[1000px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink
          href="/admin/utilitarios/titularidade"
          label="Titularidade à prefeitura"
        />
        <TransferForm values={{ service: "notas", act: "escritura" }} />
      </main>
    </>
  );
}
