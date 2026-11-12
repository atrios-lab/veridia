import {
  kindName,
  rangeLabel,
  sheetNumber,
  stockByKind,
} from "@/core/security-paper/stock.ts";
import { db } from "@/db/index.ts";
import { classifierWith } from "@/lib/security-paper.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { requirePaperAccess } from "../_lib/access.ts";
import { MovementForm } from "../forms.tsx";

export const metadata = { title: "Lançar papel de segurança" };

export default async function MovementPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; lote?: string }>;
}) {
  await requirePaperAccess();
  const tenant = await getTenant();
  const { lots, movements } = await classifierWith(db, tenant.slug);
  const query = await searchParams;
  const choices = stockByKind(lots, movements)
    .flatMap((s) => s.lots)
    .map(({ lot, remaining, next }) => ({
      id: lot.id,
      label: `${kindName(lot)} · ${rangeLabel(lot, lot.first, lot.last)}`,
      remaining,
      next: next !== null ? sheetNumber(lot, next) : null,
    }))
    // The lot asked for first, then the ones with sheets left.
    .sort(
      (a, b) =>
        Number(b.id === query.lote) - Number(a.id === query.lote) ||
        Number(b.remaining > 0) - Number(a.remaining > 0),
    );
  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title="Lançar uso ou ocorrência"
        back={{
          href: "/admin/utilitarios/papel-seguranca",
          label: "Papel de segurança",
        }}
        description="Baixe do estoque as folhas usadas nos atos, inutilizadas, avariadas, extraviadas ou subtraídas. Extravio, subtração e avaria entram na comunicação do fim do mês à Corregedoria."
      />
      <main className="flex max-w-[1000px] flex-col gap-4 px-[30px] py-7 max-md:px-4">
        <MovementForm
          lots={choices}
          today={today()}
          initialType={query.tipo ?? "utilizado"}
        />
      </main>
    </>
  );
}
