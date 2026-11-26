import { notFound } from "next/navigation";
import { FeeTableReminder } from "@/app/admin/_components/fee-table-reminder.tsx";
import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { feeTableReferenceWith } from "@/lib/fee-tables.ts";
import { loadAcervo } from "@/lib/ri.ts";
import { protocolWith } from "@/lib/ri-protocols.ts";
import { RiPage } from "../../../_components/page.tsx";
import { ProtocolForm } from "../../../_components/protocol-form.tsx";
import { requireRi } from "../../../_lib.ts";
import { formValueOf } from "../../_shared.ts";

export const metadata = { title: "Alterar protocolo" };

export default async function EditProtocolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { session, tenant } = await requireRi("ri.edit");
  const { id } = await params;
  const row = await protocolWith(db, tenant.slug, id);
  if (!row || row.voidedAt) notFound();
  const [acervo, table] = await Promise.all([
    loadAcervo(tenant.slug),
    feeTableReferenceWith(db, tenant.slug).catch(() => null),
  ]);
  const ids = (row.propertyIds as string[]) ?? [];
  const matriculas = acervo.properties
    .filter((p) => ids.includes(p.id))
    .map((p) => p.number.toLocaleString("pt-BR"))
    .join("; ");
  return (
    <RiPage
      title={`Alterar o protocolo nº ${row.number.toLocaleString("pt-BR")}`}
      description="O número de ordem não muda. Cada alteração fica no histórico, com o que era antes."
      back={{ href: `/admin/ri/protocolo/${row.id}`, label: "Protocolo" }}
    >
      <ProtocolForm
        value={formValueOf(row, matriculas)}
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
