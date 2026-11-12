import Link from "next/link";
import {
  ORDER_STATUS_LABELS,
  type OrderStatus,
  officeDataMissing,
  orderTotal,
  SupplierSchema,
} from "@/core/paper-orders/catalog.ts";
import { formatMoneyBRL } from "@/core/transparency/bulletin.ts";
import { db } from "@/db/index.ts";
import {
  getOfficeOrderDataWith,
  listOrdersWith,
  listSuppliersWith,
  orderNumber,
  orderOf,
  supplierOf,
} from "@/lib/paper-orders.ts";
import {
  getSecurityPaperSettings,
  lowStockWith,
} from "@/lib/security-paper.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminIcon } from "../../../_components/icon.tsx";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { Badge } from "../../../_ui/badge.tsx";
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import { requireOrderAccess, stockByPaperKind } from "./_lib/data.ts";
import { addStarterSuppliers } from "./actions.ts";
import { RemoveOrderButton } from "./forms.tsx";

export const metadata = { title: "Solicitação de papéis de segurança" };

const DONE: Record<string, string> = {
  empresas:
    "Empresas do padrão ANOREG/RN cadastradas. Confira e edite o que mudar.",
  empresa: "Empresa salva.",
  "empresa-excluida":
    "Empresa excluída da lista. Os pedidos antigos continuam guardados.",
  "pedido-excluido": "Pedido excluído da lista. Ele continua guardado.",
};

const date = (iso: string) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";

export default async function PaperOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ feito?: string; excluidos?: string }>;
}) {
  await requireOrderAccess();
  const tenant = await getTenant();
  const query = await searchParams;
  const [supplierRows, orders, low, settings, stock, office] =
    await Promise.all([
      listSuppliersWith(db, tenant.slug),
      listOrdersWith(db, tenant.slug, { withRemoved: query.excluidos === "1" }),
      lowStockWith(db, tenant),
      getSecurityPaperSettings(tenant),
      stockByPaperKind(tenant.slug),
      getOfficeOrderDataWith(db, tenant),
    ]);
  const suppliers = supplierRows.map((row) => ({ row, s: supplierOf(row) }));
  const missing = officeDataMissing(office);
  const done = query.feito ? DONE[query.feito] : undefined;

  return (
    <>
      <AdminPageHeader
        maxWidth={1100}
        title="Solicitação de papéis de segurança"
        description="Os pedidos de papéis às empresas (traslado, certidão, apostila, etiquetas, ribbon), no formulário de cada uma, prontos para assinar digitalmente ou imprimir."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/utilitarios/solicitacao-papeis/empresas/nova"
              className={buttonVariants({ variant: "outline" })}
            >
              <AdminIcon name="plus" className="h-4 w-4" /> Nova empresa
            </Link>
            {suppliers.length > 0 && (
              <Link
                href="/admin/utilitarios/solicitacao-papeis/novo"
                className={buttonVariants()}
              >
                <AdminIcon name="file" className="h-4 w-4" /> Novo pedido
              </Link>
            )}
          </div>
        }
      />
      <main className="flex max-w-[1100px] flex-col gap-5 px-4 py-7 md:px-8">
        {done && (
          <p className="rounded-lg border border-success/30 bg-success-soft px-4 py-3 text-sm font-medium text-success-text">
            {done}
          </p>
        )}

        {low.map((l) => {
          const match = suppliers
            .flatMap(({ row, s }) =>
              s.items
                .filter((i) => i.paperKind === l.paperKind)
                .map((i) => ({ row, s, i })),
            )
            .at(0);
          return (
            <div
              key={l.kind}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft px-5 py-4"
            >
              <AdminIcon
                name="alert"
                className="h-5 w-5 shrink-0 text-warning-text"
              />
              <div className="mr-auto min-w-[240px] flex-1">
                <p className="text-sm font-semibold text-warning-text">
                  {l.kind}:{" "}
                  {l.remaining === 0
                    ? "acabou o estoque"
                    : `restam ${l.remaining.toLocaleString("pt-BR")} folhas`}
                </p>
                <p className="text-xs text-foreground">
                  O aviso aparece quando faltam{" "}
                  {settings.lowStock.toLocaleString("pt-BR")} folhas ou menos.
                  Providencie o pedido de um novo lote.
                </p>
              </div>
              {match ? (
                <Link
                  href={`/admin/utilitarios/solicitacao-papeis/novo?empresa=${match.row.id}&item=${match.i.id}`}
                  className={buttonVariants()}
                >
                  Pedir {match.i.name} ({match.s.name.split(" (")[0]})
                </Link>
              ) : (
                <Link
                  href="/admin/utilitarios/solicitacao-papeis/novo"
                  className={buttonVariants()}
                >
                  Fazer o pedido
                </Link>
              )}
            </div>
          );
        })}

        {missing.length > 0 && (
          <p className="text-xs text-warning-text">
            Faltam nos dados do cartório: {missing.join(", ")}.{" "}
            <Link
              href="/admin/utilitarios/solicitacao-papeis/configuracao"
              className="font-medium underline underline-offset-4"
            >
              Completar agora
            </Link>
          </p>
        )}

        {suppliers.length === 0 ? (
          <section className="flex flex-col gap-3 rounded-xl border border-dashed bg-card px-5 py-5">
            <p className="text-sm font-semibold text-foreground">
              Nenhuma empresa cadastrada.
            </p>
            <p className="text-sm text-foreground">
              Comece com as empresas dos formulários da ANOREG/RN: a IGB
              (traslado, certidão RCPN, extensor, apostila e etiquetas) e a M2
              (ribbon). Tudo fica editável: se mudar de empresa, é só alterar ou
              cadastrar outra.
            </p>
            <div className="flex flex-wrap gap-2">
              <form action={addStarterSuppliers}>
                <Button type="submit">Usar as empresas da ANOREG/RN</Button>
              </form>
              <Link
                href="/admin/utilitarios/solicitacao-papeis/empresas/nova"
                className={buttonVariants({ variant: "outline" })}
              >
                Cadastrar outra empresa
              </Link>
            </div>
          </section>
        ) : (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-foreground">
              O que pedir, por empresa
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {suppliers.map(({ row, s }) => (
                <div
                  key={row.id}
                  className="flex flex-col gap-2.5 rounded-xl border bg-card px-5 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {s.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.modelPath
                          ? "Com o formulário da empresa (.docx)"
                          : "Sem formulário da empresa: sai no padrão do sistema"}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <Link
                        href={`/admin/utilitarios/solicitacao-papeis/empresas/${row.id}`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        Editar
                      </Link>
                      <Link
                        href={`/admin/utilitarios/solicitacao-papeis/novo?empresa=${row.id}`}
                        className={buttonVariants({ size: "sm" })}
                      >
                        Pedir
                      </Link>
                    </div>
                  </div>
                  <ul className="flex flex-col divide-y text-xs">
                    {s.items.map((i) => (
                      <li
                        key={i.id}
                        className="flex flex-wrap justify-between gap-2 py-1.5"
                      >
                        <span>
                          <span className="font-semibold text-foreground">
                            {i.name}
                          </span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {i.unit}
                            {i.minimum
                              ? ` · mínimo ${i.minimum.toLocaleString("pt-BR")}`
                              : ""}
                            {i.unitPriceCents !== null
                              ? ` · R$ ${formatMoneyBRL(i.unitPriceCents)}`
                              : ""}
                          </span>
                        </span>
                        {i.paperKind && (
                          <span className="text-muted-foreground tabular-nums">
                            estoque{" "}
                            {(stock.get(i.paperKind) ?? 0).toLocaleString(
                              "pt-BR",
                            )}
                          </span>
                        )}
                      </li>
                    ))}
                    {s.items.length === 0 && (
                      <li className="py-1.5 text-muted-foreground">
                        Nenhum item. Edite a empresa para incluir.
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5">
            <h2 className="text-lg font-semibold text-foreground">Pedidos</h2>
            <Link
              href={`/admin/utilitarios/solicitacao-papeis${query.excluidos === "1" ? "" : "?excluidos=1"}`}
              className="text-xs font-medium text-primary underline underline-offset-4"
            >
              {query.excluidos === "1"
                ? "Esconder os excluídos"
                : "Mostrar também os excluídos"}
            </Link>
          </div>
          {orders.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">
              Nenhum pedido ainda.
            </p>
          ) : (
            <ul>
              {orders.map((row) => {
                const order = orderOf(row);
                const supplier = SupplierSchema.parse(row.supplier);
                const total = orderTotal(order.lines);
                return (
                  <li
                    key={row.id}
                    className={`flex flex-wrap items-center gap-3 border-b px-5 py-3 last:border-0 ${row.removedAt ? "opacity-55" : ""}`}
                  >
                    <div className="mr-auto min-w-[240px]">
                      <Link
                        href={`/admin/utilitarios/solicitacao-papeis/${row.id}`}
                        className={`text-sm font-medium text-primary underline underline-offset-4 ${row.removedAt ? "line-through" : ""}`}
                      >
                        Pedido nº {orderNumber(row)} · {supplier.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {date(order.orderDate)} ·{" "}
                        {order.lines
                          .map(
                            (l) =>
                              `${l.name}: ${l.quantity.toLocaleString("pt-BR")}`,
                          )
                          .join("; ")}
                        {total !== null ? ` · R$ ${formatMoneyBRL(total)}` : ""}
                        {row.removedAt
                          ? ` · Excluído: ${row.removeReason}`
                          : ""}
                      </p>
                    </div>
                    <Badge
                      variant={
                        row.status === "enviado" ? "secondary" : "default"
                      }
                      className={
                        row.status === "recebido"
                          ? "bg-success text-success-foreground"
                          : row.status === "enviado"
                            ? undefined
                            : "bg-warning text-warning-foreground"
                      }
                    >
                      {ORDER_STATUS_LABELS[row.status as OrderStatus] ??
                        row.status}
                    </Badge>
                    {!row.removedAt && (
                      <>
                        <Link
                          href={`/admin/utilitarios/solicitacao-papeis/${row.id}/editar`}
                          className={buttonVariants({
                            variant: "outline",
                            size: "sm",
                          })}
                        >
                          Editar
                        </Link>
                        <RemoveOrderButton id={row.id} />
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
