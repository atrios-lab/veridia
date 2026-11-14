import { can } from "@/core/auth/roles.ts";
import {
  transferFromGuide,
  transferToForm,
} from "@/core/titularidade/titularidade.ts";
import { findGuide } from "@/lib/tax-guides.ts";
import { getTenant } from "@/lib/tenant.ts";
import { BackLink } from "../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { requireTitularidade } from "../_access.ts";
import { TransferForm } from "../titularidade-forms.tsx";

export const metadata = { title: "Lançar escritura ou registro" };

export default async function NewTransferPage({
  searchParams,
}: {
  searchParams: Promise<{ guia?: string }>;
}) {
  const session = await requireTitularidade();
  const { guia } = await searchParams;
  // From a guia of ITIV or ITCD already read: its parties, imóvel and value.
  const stored =
    guia &&
    can(session.user.role ?? "", "guides.manage", session.user.permissions)
      ? await findGuide((await getTenant()).slug, guia)
      : undefined;
  const values = stored
    ? transferToForm(transferFromGuide(stored.guide))
    : { service: "notas", act: "escritura" };
  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title="Lançar escritura ou registro"
        description={
          stored
            ? "Preenchido com os dados da guia. Complete a data, o livro e as folhas da escritura (ou envie o traslado para ler) e salve."
            : "Envie o documento para o sistema ler, confira os campos e salve. O ato entra na comunicação do mês em que foi praticado."
        }
      />
      <main className="flex max-w-[1000px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink
          href={
            stored
              ? `/admin/utilitarios/guias/${stored.id}`
              : "/admin/utilitarios/titularidade"
          }
          label={stored ? "Voltar à guia" : "Titularidade à prefeitura"}
        />
        <TransferForm values={values} />
      </main>
    </>
  );
}
