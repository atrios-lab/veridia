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
              className="btn btn-admin-secondary btn-md"
            >
              <AdminIcon name="plus" className="h-4 w-4" /> Nova empresa
            </Link>
            {suppliers.length > 0 && (
              <Link
                href="/admin/utilitarios/solicitacao-papeis/novo"
                className="btn btn-admin-primary btn-md"
              >
                <AdminIcon name="file" className="h-4 w-4" /> Novo pedido
              </Link>
            )}
          </div>
        }
      />
      <main className="flex max-w-[1100px] flex-col gap-5 px-[30px] py-7 max-md:px-4">
        {done && (
          <p className="rounded-[12px] bg-admin-success-bg px-4 py-3 text-[13px] font-semibold text-admin-success-text">
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
              className="flex flex-wrap items-center gap-3 rounded-[14px] border border-admin-warning-soft-border bg-admin-warning-soft-bg px-5 py-4"
            >
              <AdminIcon
                name="alert"
                className="h-5 w-5 shrink-0 text-admin-warning-text"
              />
              <div className="mr-auto min-w-[240px] flex-1">
                <p className="text-[13.5px] font-bold text-admin-warning-text">
                  {l.kind}:{" "}
                  {l.remaining === 0
                    ? "acabou o estoque"
                    : `restam ${l.remaining.toLocaleString("pt-BR")} folhas`}
                </p>
                <p className="text-[12.5px] text-admin-text">
                  O aviso aparece quando faltam{" "}
                  {settings.lowStock.toLocaleString("pt-BR")} folhas ou menos.
                  Providencie o pedido de um novo lote.
                </p>
              </div>
              {match ? (
                <Link
                  href={`/admin/utilitarios/solicitacao-papeis/novo?empresa=${match.row.id}&item=${match.i.id}`}
                  className="btn btn-admin-primary btn-md"
                >
                  Pedir {match.i.name} ({match.s.name.split(" (")[0]})
                </Link>
              ) : (
                <Link
                  href="/admin/utilitarios/solicitacao-papeis/novo"
                  className="btn btn-admin-primary btn-md"
                >
                  Fazer o pedido
                </Link>
              )}
            </div>
          );
        })}

        {missing.length > 0 && (
          <p className="text-[12.5px] text-admin-warning-text">
            Faltam nos dados do cartório: {missing.join(", ")}.{" "}
            <Link
              href="/admin/utilitarios/solicitacao-papeis/configuracao"
              className="font-semibold underline"
            >
              Completar agora
            </Link>
          </p>
        )}

        {suppliers.length === 0 ? (
          <section className="flex flex-col gap-3 rounded-[14px] border border-dashed border-admin-border bg-admin-card px-5 py-5">
            <p className="text-[14px] font-semibold text-admin-primary">
              Nenhuma empresa cadastrada.
            </p>
            <p className="text-[13px] text-admin-text">
              Comece com as empresas dos formulários da ANOREG/RN: a IGB
              (traslado, certidão RCPN, extensor, apostila e etiquetas) e a M2
              (ribbon). Tudo fica editável: se mudar de empresa, é só alterar ou
              cadastrar outra.
            </p>
            <div className="flex flex-wrap gap-2">
              <form action={addStarterSuppliers}>
                <button type="submit" className="btn btn-admin-primary btn-md">
                  Usar as empresas da ANOREG/RN
                </button>
              </form>
              <Link
                href="/admin/utilitarios/solicitacao-papeis/empresas/nova"
                className="btn btn-admin-secondary btn-md"
              >
                Cadastrar outra empresa
              </Link>
            </div>
          </section>
        ) : (
          <section className="flex flex-col gap-3">
            <h2 className="font-serif text-[19px] font-semibold text-admin-primary">
              O que pedir, por empresa
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {suppliers.map(({ row, s }) => (
                <div
                  key={row.id}
                  className="flex flex-col gap-2.5 rounded-[14px] border border-admin-border bg-admin-card px-5 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[14px] font-bold text-admin-primary">
                        {s.name}
                      </p>
                      <p className="text-[11.5px] text-admin-muted">
                        {row.modelPath
                          ? "Com o formulário da empresa (.docx)"
                          : "Sem formulário da empresa: sai no padrão do sistema"}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <Link
                        href={`/admin/utilitarios/solicitacao-papeis/empresas/${row.id}`}
                        className="btn btn-admin-secondary btn-sm"
                      >
                        Editar
                      </Link>
                      <Link
                        href={`/admin/utilitarios/solicitacao-papeis/novo?empresa=${row.id}`}
                        className="btn btn-admin-primary btn-sm"
                      >
                        Pedir
                      </Link>
                    </div>
                  </div>
                  <ul className="flex flex-col divide-y divide-admin-border text-[12.5px]">
                    {s.items.map((i) => (
                      <li
                        key={i.id}
                        className="flex flex-wrap justify-between gap-2 py-1.5"
                      >
                        <span>
                          <span className="font-semibold text-admin-text">
                            {i.name}
                          </span>
                          <span className="text-admin-muted">
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
                          <span className="text-admin-muted">
                            estoque{" "}
                            {(stock.get(i.paperKind) ?? 0).toLocaleString(
                              "pt-BR",
                            )}
                          </span>
                        )}
                      </li>
                    ))}
                    {s.items.length === 0 && (
                      <li className="py-1.5 text-admin-muted">
                        Nenhum item. Edite a empresa para incluir.
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-[14px] border border-admin-border bg-admin-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-admin-border px-5 py-3.5">
            <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
              Pedidos
            </h2>
            <Link
              href={`/admin/utilitarios/solicitacao-papeis${query.excluidos === "1" ? "" : "?excluidos=1"}`}
              className="text-[12.5px] font-semibold text-admin-primary underline"
            >
              {query.excluidos === "1"
                ? "Esconder os excluídos"
                : "Mostrar também os excluídos"}
            </Link>
          </div>
          {orders.length === 0 ? (
            <p className="px-5 py-4 text-[13px] text-admin-muted">
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
                    className={`flex flex-wrap items-center gap-3 border-b border-admin-border px-5 py-3 last:border-0 ${row.removedAt ? "opacity-55" : ""}`}
                  >
                    <div className="mr-auto min-w-[240px]">
                      <Link
                        href={`/admin/utilitarios/solicitacao-papeis/${row.id}`}
                        className={`text-[13.5px] font-semibold text-admin-primary underline ${row.removedAt ? "line-through" : ""}`}
                      >
                        Pedido nº {orderNumber(row)} · {supplier.name}
                      </Link>
                      <p className="text-[12px] text-admin-muted">
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
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${
                        row.status === "recebido"
                          ? "bg-admin-success-bg text-admin-success-text"
                          : row.status === "enviado"
                            ? "bg-admin-input-bg text-admin-primary"
                            : "bg-admin-warning-soft-bg text-admin-warning-text"
                      }`}
                    >
                      {ORDER_STATUS_LABELS[row.status as OrderStatus] ??
                        row.status}
                    </span>
                    {!row.removedAt && (
                      <>
                        <Link
                          href={`/admin/utilitarios/solicitacao-papeis/${row.id}/editar`}
                          className="btn btn-admin-secondary btn-sm"
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
