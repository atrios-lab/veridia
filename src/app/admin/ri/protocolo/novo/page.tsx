import { FeeTableReminder } from "@/app/admin/_components/fee-table-reminder.tsx";
import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { feeTableReferenceWith } from "@/lib/fee-tables.ts";
import { RiPage } from "../../_components/page.tsx";
import { ProtocolForm } from "../../_components/protocol-form.tsx";
import { requireRi } from "../../_lib.ts";

export const metadata = { title: "Novo protocolo" };

export default async function NewProtocolPage() {
  const { session, tenant } = await requireRi("ri.edit");
  const table = await feeTableReferenceWith(db, tenant.slug).catch(() => null);
  return (
    <RiPage
      title="Novo protocolo"
      description="Lance o título na hora em que ele chega: o número de ordem é dado na apresentação e fixa a prioridade (Lei nº 6.015/1973, arts. 182 e 186)."
      back={{ href: "/admin/ri/protocolo", label: "Protocolo" }}
    >
      <ProtocolForm
        feeReminder={
          <FeeTableReminder
            table={table}
            canUpdate={can(
              session.user.role ?? "",
              "transparency.manage",
              session.user.permissions,
            )}
          />
        }
      />
    </RiPage>
  );
}
