"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import type { Deadline } from "@/core/request/deadline.ts";
import type { ServiceRequestStatus } from "@/core/request/kinds.ts";
import type { IsoDate } from "@/core/scheduling/calendar.ts";
import { Checkbox } from "../../../_components/checkbox.tsx";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import { AdminIcon } from "../../../_components/icon.tsx";
import {
  type BulkActionState,
  deactivateServiceRequestsAction,
} from "../actions.ts";
import { DeadlineBadge } from "./deadline-badge.tsx";
import { statusBadgeClass } from "./status-tone.ts";

export interface QueueRow {
  id: string;
  protocolNumber: string;
  applicantName: string;
  actName: string;
  /** The attribution's sigla, under the act's name. */
  attributionLabel: string;
  status: ServiceRequestStatus;
  statusLabel: string;
  open: boolean;
  deadline: Deadline;
  /** dd/mm of the day it was filed. */
  dateText: string;
}

const OPEN_COLUMNS = "grid-cols-[22px_150px_1.6fr_1.4fr_90px_200px_96px]";
const CLOSED_COLUMNS = "grid-cols-[22px_150px_1.6fr_1.4fr_90px_150px_96px]";

/**
 * One page of the tab, plus selection: a checkbox per row, one in the
 * heading for the page, and the bar of bulk actions that appears once
 * something is ticked. Client-side because selection is transient,
 * per-viewer state that nothing else needs to know about; it is dropped on
 * navigation, on purpose, so a bulk action never reaches rows the operator
 * is not looking at.
 *
 * The row is not a link any more. It used to be, and a checkbox inside an
 * anchor toggles and navigates on the same click; "Detalhar" at the end of
 * the row is the one way in.
 */
export function QueueRows({
  rows,
  closed,
  today,
  hasFilters,
}: {
  rows: readonly QueueRow[];
  /** The Finalizados tab: Situação instead of Prazo, and a quieter row. */
  closed: boolean;
  today: IsoDate;
  hasFilters: boolean;
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [state, action, pending] = useActionState<BulkActionState, FormData>(
    deactivateServiceRequestsAction,
    { status: "idle" },
  );
  // The rows re-render from the server once the action lands; the ticks
  // would otherwise survive on ids that just left the tab.
  useEffect(() => {
    if (state.status === "success") setSelected(new Set());
  }, [state]);

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const pageIds = rows.map((r) => r.id);
  const allSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const columns = closed ? CLOSED_COLUMNS : OPEN_COLUMNS;
  const count = selected.size;
  const plural = count === 1 ? "" : "s";

  return (
    <>
      {count > 0 && (
        <div className="flex items-center gap-3.5 border-b border-admin-border bg-admin-input-bg px-[22px] py-2.5">
          <span className="flex-1 text-[13px] font-semibold text-admin-text">
            {count} protocolo{plural} selecionado{plural}
          </span>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="cursor-pointer text-[12.5px] font-semibold text-admin-muted underline underline-offset-2 hover:text-admin-primary"
          >
            Desmarcar
          </button>
          <ConfirmAction
            action={action}
            pending={pending}
            error={state.status === "error" ? state.message : null}
            trigger={
              <>
                <AdminIcon
                  name="trash"
                  strokeWidth={2}
                  className="h-[13px] w-[13px]"
                />
                Arquivar
              </>
            }
            triggerClassName="inline-flex cursor-pointer items-center gap-[7px] rounded-[8px] border border-admin-error-border/60 bg-admin-error-bg px-[13px] py-[7px] text-[12.5px] font-bold text-admin-error-text transition-colors duration-120 hover:bg-admin-error-border/30"
            question={`Arquivar ${count} protocolo${plural}?`}
            consequence="Os protocolos saem do fluxo de atendimento, mas os dados e o histórico de cada um continuam guardados. Nada é apagado: para reativar, mude o andamento pelo detalhe do protocolo."
            confirmLabel="Arquivar"
            pendingLabel="Arquivando…"
          >
            {[...selected].map((id) => (
              <input key={id} type="hidden" name="requestIds" value={id} />
            ))}
          </ConfirmAction>
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <div
            className={`grid ${columns} items-center gap-2.5 border-b border-admin-border px-[22px] py-[11px] text-[11px] font-bold tracking-[0.06em] text-admin-faint uppercase`}
          >
            <Checkbox
              label="Selecionar todos os pedidos da página"
              checked={allSelected}
              disabled={rows.length === 0}
              onChange={(e) =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  for (const id of pageIds) {
                    if (e.target.checked) next.add(id);
                    else next.delete(id);
                  }
                  return next;
                })
              }
            />
            <span>Protocolo</span>
            <span>Solicitante</span>
            <span>Ato</span>
            <span>Criado em</span>
            <span>{closed ? "Situação" : "Prazo"}</span>
            <span className="text-right">Ações</span>
          </div>

          {rows.map((row) => (
            <div
              key={row.id}
              className={`grid ${columns} items-center gap-2.5 border-b border-admin-border/60 px-[22px] py-3 text-[13px] transition-colors duration-120 hover:bg-admin-input-bg ${
                closed ? "opacity-[.85]" : ""
              }`}
            >
              <Checkbox
                label={`Selecionar protocolo ${row.protocolNumber}`}
                checked={selected.has(row.id)}
                onChange={(e) => toggle(row.id, e.target.checked)}
              />
              <span className="font-bold tabular-nums text-admin-primary">
                {row.protocolNumber}
              </span>
              <span className="min-w-0 truncate font-semibold text-admin-text">
                {row.applicantName}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-admin-muted">
                  {row.actName}
                </span>
                <span className="block text-[11px] tracking-[0.04em] text-admin-faint">
                  {row.attributionLabel}
                </span>
              </span>
              <span className="whitespace-nowrap tabular-nums text-admin-muted">
                {row.dateText}
              </span>
              <span className="min-w-0">
                {closed ? (
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${statusBadgeClass(row.status)}`}
                  >
                    {row.statusLabel}
                  </span>
                ) : row.status === "ready-for-pickup" ? (
                  // Nothing left for the office to do against a term: only
                  // the citizen's visit is pending.
                  <span className="text-[12.5px] text-admin-faint">-</span>
                ) : (
                  <DeadlineBadge
                    open={row.open}
                    deadline={row.deadline}
                    today={today}
                    showRunning
                  />
                )}
              </span>
              <span className="flex justify-end">
                <Link
                  href={`/admin/pedidos/${encodeURIComponent(row.protocolNumber)}`}
                  className="inline-flex items-center rounded-[8px] border border-admin-input-border bg-admin-card px-3 py-[7px] text-[12px] font-bold whitespace-nowrap text-admin-primary transition-colors duration-120 hover:border-admin-primary-soft hover:bg-admin-success-bg"
                >
                  Detalhar
                </Link>
              </span>
            </div>
          ))}

          {rows.length === 0 && (
            <div className="flex flex-col items-center gap-1.5 px-[22px] py-11 text-center">
              <p className="font-serif text-[17px] font-semibold text-admin-primary">
                Nenhum pedido encontrado
              </p>
              <p className="text-[13px] text-admin-muted">
                {hasFilters
                  ? "Nenhum protocolo nesta aba com esses filtros."
                  : "Nenhum pedido nesta aba."}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
