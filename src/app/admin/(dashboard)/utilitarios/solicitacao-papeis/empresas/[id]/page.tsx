import { notFound } from "next/navigation";
import { PAPER_KIND_LABELS, PAPER_KINDS } from "@/core/security-paper/stock.ts";
import { db } from "@/db/index.ts";
import { findSupplierWith, supplierOf } from "@/lib/paper-orders.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../../../_components/page-header.tsx";
import { buttonVariants } from "../../../../../_ui/button.tsx";
import { requireOrderAccess } from "../../_lib/data.ts";
import { RemoveSupplierButton, SupplierForm } from "../../forms.tsx";

export const metadata = { title: "Empresa de papéis de segurança" };

export default async function SupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOrderAccess();
  const tenant = await getTenant();
  const row = await findSupplierWith(db, tenant.slug, (await params).id);
  if (!row || row.removedAt) notFound();
  const s = supplierOf(row);
  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title={s.name}
        back={{
          href: "/admin/utilitarios/solicitacao-papeis",
          label: "Solicitação de papéis",
        }}
        description="Edite os dados, os itens e os textos da empresa. Vale para os próximos pedidos; ao editar um pedido antigo, ele também passa a usar estes dados."
        actions={
          <div className="flex flex-wrap gap-2">
            {row.modelPath && (
              <a
                href={`/admin/utilitarios/solicitacao-papeis/empresas/${row.id}/modelo`}
                className={buttonVariants({ variant: "outline" })}
              >
                Baixar o modelo enviado
              </a>
            )}
            <RemoveSupplierButton id={row.id} />
          </div>
        }
      />
      <main className="flex max-w-[1000px] flex-col gap-4 px-4 py-7 md:px-8">
        <SupplierForm
          id={row.id}
          modelName={row.modelName}
          kinds={PAPER_KINDS.map((value) => ({
            value,
            label: PAPER_KIND_LABELS[value],
          }))}
          initial={s}
        />
      </main>
    </>
  );
}
