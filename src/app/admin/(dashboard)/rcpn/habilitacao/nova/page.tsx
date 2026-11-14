import { BackLink } from "../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { requireRcpn } from "../../_lib/access.ts";
import { HabilitacaoForm } from "../habilitacao-forms.tsx";

export const metadata = { title: "Nova habilitação" };

export default async function NewHabilitacaoPage() {
  await requireRcpn("rcpn.habilitacao");
  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title="Nova habilitação de casamento"
        description="Preencha uma vez: cada documento do processo sai destes dados. O que não souber agora, complete depois."
      />
      <main className="flex max-w-[1000px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink href="/admin/rcpn/habilitacao" label="Habilitações" />
        <HabilitacaoForm
          values={{ tipo: "civil", regime: "comunhao-parcial" }}
        />
      </main>
    </>
  );
}
