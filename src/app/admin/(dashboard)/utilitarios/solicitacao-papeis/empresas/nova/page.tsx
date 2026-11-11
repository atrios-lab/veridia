import { PAPER_KIND_LABELS, PAPER_KINDS } from "@/core/security-paper/stock.ts";
import { AdminPageHeader } from "../../../../../_components/page-header.tsx";
import { requireOrderAccess } from "../../_lib/data.ts";
import { SupplierForm } from "../../forms.tsx";

export const metadata = { title: "Nova empresa de papéis de segurança" };

export default async function NewSupplierPage() {
  await requireOrderAccess();
  return (
    <>
      <AdminPageHeader
        title="Nova empresa"
        back={{
          href: "/admin/utilitarios/solicitacao-papeis",
          label: "Solicitação de papéis",
        }}
        description="Cadastre a empresa e os itens que ela vende. Se tiver o formulário de pedido dela em Word, envie e clique em Ler o modelo: os campos se preenchem sozinhos."
      />
      <main className="flex max-w-[1000px] flex-col gap-4 px-[30px] py-7 max-md:px-4">
        <SupplierForm
          kinds={PAPER_KINDS.map((value) => ({
            value,
            label: PAPER_KIND_LABELS[value],
          }))}
          initial={{
            name: "",
            cnpj: "",
            address: "",
            phone: "",
            email: "",
            website: "",
            title: "Formulário de pedido",
            intro: "",
            delivery: "",
            deliveryAddress: "",
            conditions: "",
            signatureNote: "(Somente) titular ou substituto",
            freightOptions: [],
            paymentOptions: [],
            items: [],
          }}
        />
      </main>
    </>
  );
}
