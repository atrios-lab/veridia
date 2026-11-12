import Link from "next/link";
import { notFound } from "next/navigation";
import {
  brDate,
  freeRanges,
  kindName,
  MOVEMENT_LABELS,
  type MovementType,
  PAPER_KIND_LABELS,
  PAPER_KINDS,
  rangeLabel,
  remainingIn,
  sheetNumber,
  sheetsIn,
} from "@/core/security-paper/stock.ts";
import { db } from "@/db/index.ts";
import {
  findLotWith,
  listMovementsWith,
  lotOf,
  movementOf,
} from "@/lib/security-paper.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../../../_components/page-header.tsx";
import { buttonVariants } from "../../../../../_ui/button.tsx";
import { requirePaperAccess } from "../../_lib/access.ts";
import { LotForm, VoidLotButton, VoidMovementButton } from "../../forms.tsx";

export const metadata = { title: "Lote de papel de segurança" };

export default async function LotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePaperAccess();
  const tenant = await getTenant();
  const row = await findLotWith(db, tenant.slug, (await params).id);
  if (!row) notFound();
  const lot = lotOf(row);
  const rows = (await listMovementsWith(db, tenant.slug)).filter(
    (m) => m.lotId === lot.id,
  );
  const movements = rows.map(movementOf);
  const remaining = remainingIn(lot, movements);
  const free = freeRanges(lot, movements);
  const anyLive = movements.some((m) => !m.voided);

  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title={`${kindName(lot)} · ${rangeLabel(lot, lot.first, lot.last)}`}
        back={{
          href: "/admin/utilitarios/papel-seguranca",
          label: "Papel de segurança",
        }}
        description={`${sheetsIn(lot).toLocaleString("pt-BR")} folhas ${lot.opening ? "de estoque anterior, contadas" : "recebidas"} em ${brDate(lot.receivedOn)}.`}
      />
      <main className="flex max-w-[1000px] flex-col gap-4.5 px-4 py-7 md:px-8">
        {row.voidedAt && (
          <p className="rounded-lg border border-destructive/40 bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive">
            Lote excluído: {row.voidReason}
          </p>
        )}
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-card px-5 py-4">
            <p className="text-xs font-medium text-muted-foreground">Restam</p>
            <p className="text-3xl font-semibold text-foreground tabular-nums">
              {remaining.toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="rounded-xl border bg-card px-5 py-4 sm:col-span-2">
            <p className="text-xs font-medium text-muted-foreground">
              Folhas na gaveta
            </p>
            <p className="mt-1 font-mono text-xs text-foreground">
              {free.map((r) => rangeLabel(lot, r.first, r.last)).join("; ") ||
                "Nenhuma"}
            </p>
          </div>
        </section>

        {!row.voidedAt && (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/utilitarios/papel-seguranca/lancar?lote=${lot.id}`}
              className={buttonVariants()}
            >
              Lançar folhas deste lote
            </Link>
            {row.invoicePath && (
              <a
                href={`/admin/utilitarios/papel-seguranca/lotes/${lot.id}/nota`}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "outline" })}
              >
                Ver a nota fiscal
              </a>
            )}
            {anyLive ? (
              <span className="self-center text-xs text-muted-foreground">
                Para excluir o lote, exclua antes os lançamentos dele.
              </span>
            ) : (
              <VoidLotButton id={lot.id} />
            )}
          </div>
        )}

        {!row.voidedAt && (
          <>
            <h2 className="text-lg font-semibold text-foreground">
              Editar o lote
            </h2>
            <LotForm
              kinds={PAPER_KINDS.map((value) => ({
                value,
                label: PAPER_KIND_LABELS[value],
              }))}
              today={today()}
              edit={{
                id: lot.id,
                kind: lot.kind,
                kindLabel: lot.kindLabel,
                first: sheetNumber(lot, lot.first),
                last: sheetNumber(lot, lot.last),
                receivedOn: lot.receivedOn,
                opening: lot.opening,
                supplier: lot.supplier,
                invoice: lot.invoice,
                requisition: lot.requisition,
                notes: lot.notes,
              }}
            />
          </>
        )}

        <h2 className="text-lg font-semibold text-foreground">
          Lançamentos deste lote
        </h2>
        <ul className="overflow-hidden rounded-xl border bg-card">
          {rows.length === 0 && (
            <li className="px-5 py-4 text-sm text-muted-foreground">
              Nenhum lançamento.
            </li>
          )}
          {rows.map((m) => (
            <li
              key={m.id}
              className={`flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-5 py-3 text-sm last:border-0 ${m.voidedAt ? "opacity-55" : ""}`}
            >
              <span className="w-[86px] tabular-nums">
                {brDate(m.occurredOn)}
              </span>
              <span
                className={`font-semibold ${m.voidedAt ? "line-through" : ""}`}
              >
                {MOVEMENT_LABELS[m.type as MovementType]}
              </span>
              <span className="font-mono text-xs">
                {rangeLabel(lot, m.firstNumber, m.lastNumber)}
              </span>
              <span className="mr-auto text-muted-foreground">
                {m.voidedAt
                  ? `Excluído: ${m.voidReason}`
                  : [m.reference, m.notes].filter(Boolean).join(" · ")}
              </span>
              {!m.voidedAt && (
                <>
                  <Link
                    href={`/admin/utilitarios/papel-seguranca/lancamentos/${m.id}`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    Editar
                  </Link>
                  <VoidMovementButton id={m.id} />
                </>
              )}
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
