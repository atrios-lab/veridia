"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "../../_ui/button.tsx";
import { type RiState, setCnmInPgvAction } from "../actions.ts";
import { useRiToast } from "./client.tsx";

const IDLE: RiState = { status: "idle" };

export interface CnmRow {
  id: string;
  number: number;
  status: string;
  cnm: string;
  expected: string;
  problem: string;
  inPgv: boolean;
}

/** The matrículas with their CNM, marked in bulk as already in the PGV. */
export function CnmTable({
  rows,
  canEdit,
}: {
  rows: CnmRow[];
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(setCnmInPgvAction, IDLE);
  useRiToast(state);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const all = picked.size === rows.length && rows.length > 0;
  return (
    <form action={action} className="flex flex-col gap-3">
      {[...picked].map((id) => (
        <input key={id} type="hidden" name="ids" value={id} />
      ))}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {picked.size} marcada(s)
          </span>
          <Button
            type="submit"
            name="op"
            value="add"
            size="sm"
            disabled={pending || picked.size === 0}
          >
            Já estão no PGV-CNM
          </Button>
          <Button
            type="submit"
            name="op"
            value="remove"
            size="sm"
            variant="outline"
            disabled={pending || picked.size === 0}
          >
            Voltar para o próximo lote
          </Button>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
        <table className="w-full min-w-2xl text-left text-sm">
          <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
            <tr>
              {canEdit && (
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Marcar todas"
                    checked={all}
                    onChange={() =>
                      setPicked(
                        all ? new Set() : new Set(rows.map((r) => r.id)),
                      )
                    }
                    className="size-4"
                  />
                </th>
              )}
              <th className="px-3 py-2 font-medium">Matrícula</th>
              <th className="px-3 py-2 font-medium">Situação</th>
              <th className="px-3 py-2 font-medium">CNM lançado</th>
              <th className="px-3 py-2 font-medium">CNM calculado</th>
              <th className="px-3 py-2 font-medium">PGV-CNM</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.id}>
                {canEdit && (
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Marcar a matrícula ${row.number}`}
                      checked={picked.has(row.id)}
                      onChange={() => toggle(row.id)}
                      className="size-4"
                    />
                  </td>
                )}
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/ri/matriculas/${row.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {row.number.toLocaleString("pt-BR")}
                  </Link>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {row.status}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {row.cnm || (
                    <span className="text-muted-foreground">não lançado</span>
                  )}
                  {row.problem && (
                    <span className="block text-xs text-warning-text">
                      {row.problem}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">
                  {row.expected}
                </td>
                <td className="px-3 py-2 text-xs">
                  {row.inPgv ? (
                    <span className="text-success-text">cadastrado</span>
                  ) : (
                    <span className="text-warning-text">
                      vai no próximo lote
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
}
