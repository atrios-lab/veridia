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
import { buttonVariants } from "../../../../_ui/button.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../_ui/table.tsx";
import { requireOrderAccess } from "../_lib/data.ts";
import { OrderStatusForm, RemoveOrderButton } from "../forms.tsx";

export const metadata = { title: "Pedido de papéis de segurança" };

const TH = "px-4 text-xs font-medium text-muted-foreground";

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
        maxWidth={1000}
        title={`Pedido nº ${number}`}
        back={{
          href: "/admin/utilitarios/solicitacao-papeis",
          label: "Solicitação de papéis",
        }}
        description={`${supplier.name} · ${date(order.orderDate)} · ${ORDER_STATUS_LABELS[row.status as OrderStatus] ?? row.status}`}
      />
      <main className="flex max-w-[1000px] flex-col gap-4.5 px-4 py-7 md:px-8">
        {row.removedAt && (
          <p className="rounded-lg border border-destructive/40 bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive">
            Pedido excluído: {row.removeReason}
          </p>
        )}
        {(query.gerado || query.editado) && !row.removedAt && (
          <p className="rounded-lg border border-success/30 bg-success-soft px-4 py-3 text-sm font-medium text-success-text">
            {query.gerado ? "Pedido gerado." : "Pedido alterado."} Confira,
            assine e envie à empresa.
          </p>
        )}

        <section className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-5 py-4">
          <div className="mr-auto">
            <p className="text-sm font-semibold text-foreground">
              Pedido nº {number}
            </p>
            <p className="text-xs text-muted-foreground">
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
              className={buttonVariants({ variant: "outline" })}
            >
              Baixar no formulário da empresa (.docx)
            </a>
          )}
        </section>

        {live?.modelPath && offForm.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {offForm.join(", ")} não {offForm.length === 1 ? "está" : "estão"}{" "}
            no formulário da empresa: {offForm.length === 1 ? "vai" : "vão"} no
            PDF; no Word, escreva à mão ou envie o PDF junto.
          </p>
        )}

        <section className="overflow-hidden rounded-xl border bg-card">
          <Table className="min-w-[560px]">
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className={TH}>Item</TableHead>
                <TableHead className={`${TH} text-right`}>Quantidade</TableHead>
                <TableHead className={TH}>Unidade</TableHead>
                <TableHead className={`${TH} text-right`}>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.lines.map((l) => (
                <TableRow key={`${l.itemId}-${l.name}`}>
                  <TableCell className="px-4 py-2.5 whitespace-normal">
                    {l.name}
                    {l.note && (
                      <span className="block text-xs text-muted-foreground">
                        {l.note}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right tabular-nums">
                    {l.quantity.toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{l.unit}</TableCell>
                  <TableCell className="px-4 py-2.5 text-right tabular-nums">
                    {lineTotal(l) === null
                      ? "-"
                      : `R$ ${formatMoneyBRL(lineTotal(l) ?? 0)}`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>

        {!row.removedAt && (
          <>
            <div className="flex flex-wrap gap-2">
              <Link href={`${base}/editar`} className={buttonVariants()}>
                Editar pedido
              </Link>
              <RemoveOrderButton id={row.id} />
              {row.status === "recebido" && (
                <Link
                  href="/admin/utilitarios/papel-seguranca/novo-lote"
                  className={buttonVariants({ variant: "outline" })}
                >
                  Cadastrar o lote recebido
                </Link>
              )}
            </div>
            <h2 className="text-lg font-semibold text-foreground">
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
