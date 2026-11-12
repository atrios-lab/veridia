import { PAPER_KIND_LABELS, PAPER_KINDS } from "@/core/security-paper/stock.ts";
import { today } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { requirePaperAccess } from "../_lib/access.ts";
import { LotForm } from "../forms.tsx";

export const metadata = { title: "Cadastrar lote de papel de segurança" };

export default async function NewLotPage() {
  await requirePaperAccess();
  return (
    <>
      <AdminPageHeader
        maxWidth={900}
        title="Cadastrar lote"
        back={{
          href: "/admin/utilitarios/papel-seguranca",
          label: "Papel de segurança",
        }}
        description="Um lote é uma sequência de folhas numeradas que chegou à serventia. Informe a primeira e a última folha: o sistema conta as folhas e controla o estoque."
      />
      <main className="flex max-w-[900px] flex-col gap-4 px-4 py-7 md:px-8">
        <LotForm
          kinds={PAPER_KINDS.map((value) => ({
            value,
            label: PAPER_KIND_LABELS[value],
          }))}
          today={today()}
        />
      </main>
    </>
  );
}
