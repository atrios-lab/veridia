"use client";

import Link from "next/link";
import { Fragment, useActionState, useState } from "react";
import type { Deadline } from "@/core/request/deadline.ts";
import type { ServiceRequestStatus } from "@/core/request/kinds.ts";
import type { IsoDate } from "@/core/scheduling/calendar.ts";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import {
  type BulkActionState,
  deactivateServiceRequestsAction,
} from "../actions.ts";
import { DeadlineBadge } from "./deadline-badge.tsx";
import { QUEUE_GROUPS } from "./queue-order.ts";
import { StatusBadge } from "./status-badge.tsx";
import type { Tone } from "./status-tone.ts";

export interface QueueRow {
  id: string;
  protocolNumber: string;
  applicantName: string;
  contact: string;
  actName: string;
  status: ServiceRequestStatus;
  statusLabel: string;
  open: boolean;
  deadline: Deadline;
  amountText: string;
  dateText: string;
  group: Tone;
}

/**
 * The fila's rows, plus selection: a checkbox per row and one bulk action
 * ("Marcar como inativo"). Client-side because selection is transient,
 * per-viewer state that nothing else needs to know about.
 *
 * The checkbox sits outside the row's `<Link>` on purpose — a checkbox inside
 * an anchor would toggle and navigate on the same click.
 */
export function QueueRows({
  rows,
  showBands,
  today,
  emptyMessage,
}: {
  rows: readonly QueueRow[];
  showBands: boolean;
  today: IsoDate;
  emptyMessage: string;
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [state, action, pending] = useActionState<BulkActionState, FormData>(
    deactivateServiceRequestsAction,
    { status: "idle" },
  );
  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const allSelected = rows.length > 0 && selected.size === rows.length;

  return (
    <div className="overflow-hidden rounded-[14px] border border-admin-border bg-admin-card">
      {selected.size > 0 && (
        <div className="flex items-center gap-3 border-b border-admin-border bg-admin-input-bg px-5 py-2.5">
          <span className="text-[13px] font-semibold text-admin-text">
            {selected.size} protocolo{selected.size === 1 ? "" : "s"}{" "}
            selecionado{selected.size === 1 ? "" : "s"}
          </span>
          <ConfirmAction
            action={action}
            pending={pending}
            error={state.status === "error" ? state.message : null}
            trigger="Marcar como inativo"
            question={`Marcar ${selected.size} protocolo${selected.size === 1 ? "" : "s"} como inativo${selected.size === 1 ? "" : "s"}?`}
            consequence="Os protocolos saem do fluxo de atendimento, mas os dados e o histórico de cada um continuam guardados. Nada é apagado — para reativar, mude o andamento pelo detalhe do protocolo."
            confirmLabel="Marcar como inativo"
            pendingLabel="Marcando…"
          >
            {[...selected].map((id) => (
              <input key={id} type="hidden" name="requestIds" value={id} />
            ))}
          </ConfirmAction>
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-admin-border px-5 py-2.5 text-[11px] font-bold tracking-[0.06em] text-admin-faint uppercase">
        <input
          type="checkbox"
          aria-label="Selecionar todos os pedidos"
          checked={allSelected}
          onChange={(e) =>
            setSelected(
              e.target.checked ? new Set(rows.map((r) => r.id)) : new Set(),
            )
          }
          className="h-3.5 w-3.5"
        />
        <div className="grid flex-1 grid-cols-[150px_1.6fr_1.4fr_170px_110px_100px_20px] gap-2">
          <span>Protocolo</span>
          <span>Solicitante</span>
          <span>Ato</span>
          <span>Andamento</span>
          <span>Valor</span>
          <span>Data</span>
          <span />
        </div>
      </div>

      {rows.length === 0 && (
        <p className="px-5 py-8 text-center text-[13px] text-admin-muted">
          {emptyMessage}
        </p>
      )}

      {rows.map((row, index) => {
        const band =
          showBands && rows[index - 1]?.group !== row.group
            ? QUEUE_GROUPS.find((g) => g.id === row.group)
            : undefined;
        const count = band
          ? rows.filter((r) => r.group === row.group).length
          : 0;
        return (
          <Fragment key={row.id}>
            {band ? (
              <div className="flex items-center gap-2 border-b border-admin-border bg-admin-input-bg px-5 py-2 text-[11px] font-bold tracking-[0.06em] text-admin-faint uppercase">
                <span>{band.label}</span>
                <span className="rounded-full bg-admin-card px-2 py-0.5 tabular-nums">
                  {count}
                </span>
              </div>
            ) : null}
            <div className="flex items-center gap-2 border-b border-admin-border px-5 last:border-b-0 hover:bg-admin-input-bg">
              <input
                type="checkbox"
                aria-label={`Selecionar protocolo ${row.protocolNumber}`}
                checked={selected.has(row.id)}
                onChange={(e) => toggle(row.id, e.target.checked)}
                className="h-3.5 w-3.5"
              />
              <Link
                href={`/admin/pedidos/${encodeURIComponent(row.protocolNumber)}`}
                className="grid flex-1 grid-cols-[150px_1.6fr_1.4fr_170px_110px_100px_20px] items-center gap-2 py-3 text-[13px]"
              >
                <span className="font-bold tabular-nums text-admin-primary">
                  {row.protocolNumber}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-admin-text">
                    {row.applicantName}
                  </span>
                  <span className="block truncate text-[11.5px] text-admin-faint">
                    {row.contact}
                  </span>
                </span>
                <span className="truncate text-admin-muted">{row.actName}</span>
                <span className="flex flex-col items-start gap-1">
                  <StatusBadge status={row.status} label={row.statusLabel} />
                  <DeadlineBadge
                    open={row.open}
                    deadline={row.deadline}
                    today={today}
                  />
                </span>
                <span className="tabular-nums text-admin-text">
                  {row.amountText}
                </span>
                <span className="text-admin-faint">{row.dateText}</span>
                <span aria-hidden="true" className="text-admin-faint">
                  ›
                </span>
              </Link>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
