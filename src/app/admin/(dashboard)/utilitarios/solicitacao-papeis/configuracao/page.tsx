import { db } from "@/db/index.ts";
import { getOfficeOrderDataWith } from "@/lib/paper-orders.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { requireOrderAccess } from "../_lib/data.ts";
import { OfficeDataForm } from "../forms.tsx";

export const metadata = { title: "Dados do cartório para os pedidos" };

export default async function OfficeDataPage() {
  await requireOrderAccess();
  const tenant = await getTenant();
  return (
    <>
      <AdminPageHeader
        title="Dados do cartório para os pedidos"
        back={{
          href: "/admin/utilitarios/solicitacao-papeis",
          label: "Solicitação de papéis",
        }}
        description="Os dados que vão em todo pedido e no formulário da empresa: cartório, CNS, responsável, faturamento e contato."
      />
      <main className="flex max-w-[900px] flex-col gap-4 px-[30px] py-7 max-md:px-4">
        <OfficeDataForm initial={await getOfficeOrderDataWith(db, tenant)} />
      </main>
    </>
  );
}
