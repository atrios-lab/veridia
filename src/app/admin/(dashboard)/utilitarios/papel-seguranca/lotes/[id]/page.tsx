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
        title={`${kindName(lot)} · ${rangeLabel(lot, lot.first, lot.last)}`}
        back={{
          href: "/admin/utilitarios/papel-seguranca",
          label: "Papel de segurança",
        }}
        description={`${sheetsIn(lot).toLocaleString("pt-BR")} folhas ${lot.opening ? "de estoque anterior, contadas" : "recebidas"} em ${brDate(lot.receivedOn)}.`}
      />
      <main className="flex max-w-[1000px] flex-col gap-4.5 px-[30px] py-7 max-md:px-4">
        {row.voidedAt && (
          <p className="rounded-[12px] bg-admin-error-bg px-4 py-3 text-[13px] font-semibold text-admin-error-text">
            Lote excluído: {row.voidReason}
          </p>
        )}
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
            <p className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-admin-muted">
              Restam
            </p>
            <p className="font-serif text-[28px] font-semibold text-admin-primary">
              {remaining.toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4 sm:col-span-2">
            <p className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-admin-muted">
              Folhas na gaveta
            </p>
            <p className="mt-1 font-mono text-[12.5px] text-admin-text">
              {free.map((r) => rangeLabel(lot, r.first, r.last)).join("; ") ||
                "Nenhuma"}
            </p>
          </div>
        </section>

        {!row.voidedAt && (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/utilitarios/papel-seguranca/lancar?lote=${lot.id}`}
              className="btn btn-admin-primary btn-md"
            >
              Lançar folhas deste lote
            </Link>
            {row.invoicePath && (
              <a
                href={`/admin/utilitarios/papel-seguranca/lotes/${lot.id}/nota`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-admin-secondary btn-md"
              >
                Ver a nota fiscal
              </a>
            )}
            {anyLive ? (
              <span className="self-center text-[12px] text-admin-muted">
                Para excluir o lote, exclua antes os lançamentos dele.
              </span>
            ) : (
              <VoidLotButton id={lot.id} />
            )}
          </div>
        )}

        {!row.voidedAt && (
          <>
            <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
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

        <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
          Lançamentos deste lote
        </h2>
        <ul className="overflow-hidden rounded-[14px] border border-admin-border bg-admin-card">
          {rows.length === 0 && (
            <li className="px-5 py-4 text-[13px] text-admin-muted">
              Nenhum lançamento.
            </li>
          )}
          {rows.map((m) => (
            <li
              key={m.id}
              className={`flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-admin-border px-5 py-3 text-[13px] last:border-0 ${m.voidedAt ? "opacity-55" : ""}`}
            >
              <span className="w-[86px]">{brDate(m.occurredOn)}</span>
              <span
                className={`font-semibold ${m.voidedAt ? "line-through" : ""}`}
              >
                {MOVEMENT_LABELS[m.type as MovementType]}
              </span>
              <span className="font-mono text-[12px]">
                {rangeLabel(lot, m.firstNumber, m.lastNumber)}
              </span>
              <span className="mr-auto text-admin-muted">
                {m.voidedAt
                  ? `Excluído: ${m.voidReason}`
                  : [m.reference, m.notes].filter(Boolean).join(" · ")}
              </span>
              {!m.voidedAt && (
                <>
                  <Link
                    href={`/admin/utilitarios/papel-seguranca/lancamentos/${m.id}`}
                    className="btn btn-admin-secondary btn-sm"
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
