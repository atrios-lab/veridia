import { notFound } from "next/navigation";
import { db } from "@/db/index.ts";
import { findOrderWith, orderNumber, orderOf } from "@/lib/paper-orders.ts";
import { getGuideSettings } from "@/lib/tax-guides.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../../../_components/page-header.tsx";
import { requireOrderAccess, supplierChoices } from "../../_lib/data.ts";
import { OrderForm } from "../../forms.tsx";

export const metadata = { title: "Editar pedido de papéis de segurança" };

export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOrderAccess();
  const tenant = await getTenant();
  const row = await findOrderWith(db, tenant.slug, (await params).id);
  if (!row || row.removedAt) notFound();
  const order = orderOf(row);
  const suppliers = await supplierChoices(tenant);
  const supplier = suppliers.find((s) => s.id === row.supplierId);
  const known = new Set(supplier?.items.map((i) => i.id) ?? []);
  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title={`Editar pedido nº ${orderNumber(row)}`}
        back={{
          href: `/admin/utilitarios/solicitacao-papeis/${row.id}`,
          label: "Pedido",
        }}
        description="Altere as quantidades, os itens, o frete, o pagamento ou a data. O número do pedido continua o mesmo."
      />
      <main className="flex max-w-[1000px] flex-col gap-4 px-4 py-7 md:px-8">
        <OrderForm
          suppliers={suppliers.filter((s) => s.id === row.supplierId)}
          signers={(await getGuideSettings(tenant)).signers.map(
            ({ name, title }) => ({ name, title }),
          )}
          today={today()}
          initial={{
            id: row.id,
            supplierId: row.supplierId,
            quantities: Object.fromEntries(
              order.lines
                .filter((l) => l.itemId && known.has(l.itemId))
                .map((l) => [l.itemId as string, String(l.quantity)]),
            ),
            extras: order.lines
              .filter((l) => !l.itemId || !known.has(l.itemId))
              .map((l) => ({
                name: l.name,
                unit: l.unit,
                quantity: l.quantity,
                unitPriceCents: l.unitPriceCents,
                note: l.note,
              })),
            freight: order.freight,
            payment: order.payment,
            notes: order.notes,
            orderDate: order.orderDate,
            signer: order.signer,
          }}
        />
      </main>
    </>
  );
}
