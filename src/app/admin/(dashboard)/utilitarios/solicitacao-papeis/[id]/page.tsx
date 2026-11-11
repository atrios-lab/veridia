import Link from "next/link";
import { notFound } from "next/navigation";
import {
  lineTotal,
  ORDER_STATUS_LABELS,
  type OrderStatus,
  orderTotal,
  SupplierSchema,
  sameItem,
} from "@/core/paper-orders/catalog.ts";
import { formatMoneyBRL } from "@/core/transparency/bulletin.ts";
import { db } from "@/db/index.ts";
import {
  findOrderWith,
  findSupplierWith,
  modelItemNames,
  orderNumber,
  orderOf,
} from "@/lib/paper-orders.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { SignOrPrint } from "../../../../_components/sign-or-print.tsx";
import { requireOrderAccess } from "../_lib/data.ts";
import { OrderStatusForm, RemoveOrderButton } from "../forms.tsx";

export const metadata = { title: "Pedido de papéis de segurança" };

const date = (iso: string) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ gerado?: string; editado?: string }>;
}) {
  await requireOrderAccess();
  const tenant = await getTenant();
  const row = await findOrderWith(db, tenant.slug, (await params).id);
  if (!row) notFound();
  const order = orderOf(row);
  const supplier = SupplierSchema.parse(row.supplier);
  const live = await findSupplierWith(db, tenant.slug, row.supplierId);
  const number = orderNumber(row);
  const total = orderTotal(order.lines);
  const query = await searchParams;
  const base = `/admin/utilitarios/solicitacao-papeis/${row.id}`;
  // Lines with no blank on the supplier's Word form (typed in this order,
  // or added to the list after the form was read).
  const printed = live?.modelPath ? await modelItemNames(live.modelPath) : [];
  const offForm = order.lines
    .filter((l) => !printed.some((name) => sameItem(name, l.name)))
    .map((l) => l.name);

  return (
    <>
      <AdminPageHeader
        title={`Pedido nº ${number}`}
        back={{
          href: "/admin/utilitarios/solicitacao-papeis",
          label: "Solicitação de papéis",
        }}
        description={`${supplier.name} · ${date(order.orderDate)} · ${ORDER_STATUS_LABELS[row.status as OrderStatus] ?? row.status}`}
      />
      <main className="flex max-w-[1000px] flex-col gap-4.5 px-[30px] py-7 max-md:px-4">
        {row.removedAt && (
          <p className="rounded-[12px] bg-admin-error-bg px-4 py-3 text-[13px] font-semibold text-admin-error-text">
            Pedido excluído: {row.removeReason}
          </p>
        )}
        {(query.gerado || query.editado) && !row.removedAt && (
          <p className="rounded-[12px] bg-admin-success-bg px-4 py-3 text-[13px] font-semibold text-admin-success-text">
            {query.gerado ? "Pedido gerado." : "Pedido alterado."} Confira,
            assine e envie à empresa.
          </p>
        )}

        <section className="flex flex-wrap items-center gap-3 rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <div className="mr-auto">
            <p className="text-[13px] font-bold text-admin-primary">
              Pedido nº {number}
            </p>
            <p className="text-[12px] text-admin-muted">
              {order.lines.length} item(ns)
              {total !== null ? ` · total R$ ${formatMoneyBRL(total)}` : ""}
            </p>
          </div>
          <SignOrPrint
            pdfHref={`${base}/arquivo`}
            title={`Pedido nº ${number} (${supplier.name})`}
          />
          {live?.modelPath && (
            <a
              href={`${base}/modelo`}
              className="btn btn-admin-secondary btn-md"
            >
              Baixar no formulário da empresa (.docx)
            </a>
          )}
        </section>

        {live?.modelPath && offForm.length > 0 && (
          <p className="text-[12.5px] text-admin-muted">
            {offForm.join(", ")} não {offForm.length === 1 ? "está" : "estão"}{" "}
            no formulário da empresa: {offForm.length === 1 ? "vai" : "vão"} no
            PDF; no Word, escreva à mão ou envie o PDF junto.
          </p>
        )}

        <section className="overflow-x-auto rounded-[14px] border border-admin-border bg-admin-card">
          <table className="w-full min-w-[560px]">
            <thead className="border-b border-admin-border bg-admin-input-bg">
              <tr className="text-left text-[11px] font-bold uppercase tracking-[0.05em] text-admin-muted">
                <th className="px-4 py-2.5">Item</th>
                <th className="px-4 py-2.5 text-right">Quantidade</th>
                <th className="px-4 py-2.5">Unidade</th>
                <th className="px-4 py-2.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((l) => (
                <tr
                  key={`${l.itemId}-${l.name}`}
                  className="border-b border-admin-border text-[13px] last:border-0"
                >
                  <td className="px-4 py-2.5">
                    {l.name}
                    {l.note && (
                      <span className="block text-[11.5px] text-admin-muted">
                        {l.note}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {l.quantity.toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-2.5">{l.unit}</td>
                  <td className="px-4 py-2.5 text-right">
                    {lineTotal(l) === null
                      ? "-"
                      : `R$ ${formatMoneyBRL(lineTotal(l) ?? 0)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {!row.removedAt && (
          <>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`${base}/editar`}
                className="btn btn-admin-primary btn-md"
              >
                Editar pedido
              </Link>
              <RemoveOrderButton id={row.id} />
              {row.status === "recebido" && (
                <Link
                  href="/admin/utilitarios/papel-seguranca/novo-lote"
                  className="btn btn-admin-secondary btn-md"
                >
                  Cadastrar o lote recebido
                </Link>
              )}
            </div>
            <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
              Envio e recebimento
            </h2>
            <OrderStatusForm
              id={row.id}
              status={row.status}
              sentOn={row.sentOn}
              receivedOn={row.receivedOn}
              today={today()}
            />
          </>
        )}
      </main>
    </>
  );
}
