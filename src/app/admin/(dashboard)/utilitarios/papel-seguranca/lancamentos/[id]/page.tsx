import { notFound } from "next/navigation";
import { kindName, sheetNumber } from "@/core/security-paper/stock.ts";
import { db } from "@/db/index.ts";
import { classifierWith } from "@/lib/security-paper.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../../../_components/page-header.tsx";
import { requirePaperAccess } from "../../_lib/access.ts";
import { MovementEditForm, VoidMovementButton } from "../../forms.tsx";

export const metadata = { title: "Editar lançamento de papel de segurança" };

export default async function MovementEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePaperAccess();
  const tenant = await getTenant();
  const id = (await params).id;
  const { lots, movementRows } = await classifierWith(db, tenant.slug);
  const row = movementRows.find((m) => m.id === id);
  const lot = row && lots.find((l) => l.id === row.lotId);
  if (!row || !lot || row.voidedAt) notFound();
  return (
    <>
      <AdminPageHeader
        title="Editar lançamento"
        back={{
          href: "/admin/utilitarios/papel-seguranca",
          label: "Papel de segurança",
        }}
        description={`${kindName(lot)} · lote ${sheetNumber(lot, lot.first)} a ${sheetNumber(lot, lot.last)}. Corrija o que estiver errado; a auditoria guarda a alteração.`}
        actions={<VoidMovementButton id={row.id} />}
      />
      <main className="flex max-w-[1000px] flex-col gap-4 px-[30px] py-7 max-md:px-4">
        <MovementEditForm
          id={row.id}
          today={today()}
          initial={{
            type: row.type,
            first: sheetNumber(lot, row.firstNumber),
            last: sheetNumber(lot, row.lastNumber),
            occurredOn: row.occurredOn,
            reference: row.reference,
            notes: row.notes,
          }}
        />
      </main>
    </>
  );
}
