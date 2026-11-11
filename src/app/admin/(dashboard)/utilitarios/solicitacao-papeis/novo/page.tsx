import { getGuideSettings } from "@/lib/tax-guides.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { requireOrderAccess, supplierChoices } from "../_lib/data.ts";
import { OrderForm } from "../forms.tsx";

export const metadata = { title: "Novo pedido de papéis de segurança" };

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{
    empresa?: string;
    item?: string;
    quantidade?: string;
  }>;
}) {
  await requireOrderAccess();
  const tenant = await getTenant();
  const [suppliers, guide, query] = await Promise.all([
    supplierChoices(tenant),
    getGuideSettings(tenant),
    searchParams,
  ]);
  const supplier =
    suppliers.find((s) => s.id === query.empresa) ?? suppliers[0];
  const item = supplier?.items.find((i) => i.id === query.item);
  return (
    <>
      <AdminPageHeader
        title="Novo pedido"
        back={{
          href: "/admin/utilitarios/solicitacao-papeis",
          label: "Solicitação de papéis",
        }}
        description="Escolha a empresa e informe as quantidades. O pedido sai pronto no padrão da empresa, para assinar digitalmente ou imprimir."
      />
      <main className="flex max-w-[1000px] flex-col gap-4 px-[30px] py-7 max-md:px-4">
        <OrderForm
          suppliers={suppliers}
          signers={guide.signers.map(({ name, title }) => ({ name, title }))}
          today={today()}
          initial={{
            supplierId: supplier?.id,
            quantities: item
              ? { [item.id]: query.quantidade ?? String(item.minimum || "") }
              : {},
          }}
        />
      </main>
    </>
  );
}
