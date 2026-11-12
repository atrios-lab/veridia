"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import type { Deadline } from "@/core/request/deadline.ts";
import type { ServiceRequestStatus } from "@/core/request/kinds.ts";
import type { IsoDate, OfficeHolidays } from "@/core/scheduling/calendar.ts";
import { Checkbox } from "../../../_components/checkbox.tsx";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import { AdminIcon } from "../../../_components/icon.tsx";
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import { cn } from "../../../_ui/cn.ts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../_ui/table.tsx";
import {
  type BulkActionState,
  deactivateServiceRequestsAction,
} from "../actions.ts";
import { DeadlineBadge } from "./deadline-badge.tsx";
import { StatusBadge } from "./status-badge.tsx";

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

/** The column heading: a caption, not a shout. */
const HEAD = "text-xs font-medium text-muted-foreground";

/**
 * One page of the tab, plus selection: a checkbox per row, one in the
 * heading for the page, and the bar of bulk actions that appears once
 * something is ticked. Client-side because selection is transient,
 * per-viewer state that nothing else needs to know about; it is dropped on
 * navigation, on purpose, so a bulk action never reaches rows the operator
 * is not looking at.
 *
 * The row is not a link any more. It used to be, and a checkbox inside an
 * anchor toggles and navigates on the same click; the protocol number and
 * "Detalhar" at the end of the row are the ways in.
 */
export function QueueRows({
  rows,
  closed,
  today,
  holidays,
  hasFilters,
}: {
  rows: readonly QueueRow[];
  /** The Finalizados tab: Situação instead of Prazo, and a quieter row. */
  closed: boolean;
  today: IsoDate;
  holidays: OfficeHolidays;
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
  const count = selected.size;
  const plural = count === 1 ? "" : "s";

  return (
    <>
      {count > 0 && (
        <div className="flex items-center gap-3 border-b bg-muted/50 px-4 py-2">
          <span className="flex-1 text-sm font-medium text-foreground">
            {count} protocolo{plural} selecionado{plural}
          </span>
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => setSelected(new Set())}
            className="text-muted-foreground hover:text-foreground"
          >
            Desmarcar
          </Button>
          <ConfirmAction
            action={action}
            pending={pending}
            error={state.status === "error" ? state.message : null}
            trigger={
              <>
                <AdminIcon name="trash" strokeWidth={2} className="size-3.5" />
                Arquivar
              </>
            }
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

      <Table className="min-w-225 table-fixed">
        <colgroup>
          <col className="w-10" />
          <col className="w-40" />
          <col />
          <col />
          <col className="w-24" />
          <col className={closed ? "w-40" : "w-52"} />
          <col className="w-28" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">
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
            </TableHead>
            <TableHead className={HEAD}>Protocolo</TableHead>
            <TableHead className={HEAD}>Solicitante</TableHead>
            <TableHead className={HEAD}>Ato</TableHead>
            <TableHead className={HEAD}>Criado em</TableHead>
            <TableHead className={HEAD}>
              {closed ? "Situação" : "Prazo"}
            </TableHead>
            <TableHead className={cn(HEAD, "pr-4 text-right")}>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const href = `/admin/pedidos/${encodeURIComponent(row.protocolNumber)}`;
            return (
              <TableRow
                key={row.id}
                data-state={selected.has(row.id) ? "selected" : undefined}
                className={cn(closed && "opacity-85")}
              >
                <TableCell className="pl-4">
                  <Checkbox
                    label={`Selecionar protocolo ${row.protocolNumber}`}
                    checked={selected.has(row.id)}
                    onChange={(e) => toggle(row.id, e.target.checked)}
                  />
                </TableCell>
                <TableCell>
                  <Link
                    href={href}
                    className="font-medium text-primary tabular-nums underline-offset-4 hover:underline"
                  >
                    {row.protocolNumber}
                  </Link>
                </TableCell>
                <TableCell className="truncate font-medium text-foreground">
                  {row.applicantName}
                </TableCell>
                <TableCell>
                  <span className="block truncate text-muted-foreground">
                    {row.actName}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {row.attributionLabel}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {row.dateText}
                </TableCell>
                <TableCell>
                  {closed ? (
                    <StatusBadge status={row.status} label={row.statusLabel} />
                  ) : row.status === "ready-for-pickup" ? (
                    // Nothing left for the office to do against a term: only
                    // the citizen's visit is pending.
                    <span className="text-xs text-muted-foreground">-</span>
                  ) : (
                    <DeadlineBadge
                      open={row.open}
                      deadline={row.deadline}
                      today={today}
                      holidays={holidays}
                      showRunning
                    />
                  )}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <Link
                    href={href}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    Detalhar
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}

          {rows.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={7} className="px-4 py-12 text-center">
                <p className="text-lg font-semibold text-foreground">
                  Nenhum pedido encontrado
                </p>
                <p className="mt-1 text-sm whitespace-normal text-muted-foreground">
                  {hasFilters
                    ? "Nenhum protocolo nesta etapa com esses filtros."
                    : "Nenhum pedido nesta etapa."}
                </p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
