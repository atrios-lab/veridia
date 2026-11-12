"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import { Button } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import { Label } from "../../../_ui/label.tsx";
import {
  clearNumbering,
  type NumberingState,
  removeIssued,
  renumberIssued,
} from "./actions.ts";

export interface IssuedItem {
  id: string;
  year: number;
  sequence: number;
  /** "003/2026" */
  number: string;
  description: string;
  href: string;
}

function useToast(state: NumberingState) {
  useEffect(() => {
    if (state.status === "saved") toast.success(state.message);
  }, [state]);
}

function IssuedRow({
  series,
  item,
}: {
  series: "guia" | "declaracao-iss";
  item: IssuedItem;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<NumberingState, FormData>(
    renumberIssued,
    { status: "idle" },
  );
  const [removeState, remove, removing] = useActionState<
    NumberingState,
    FormData
  >(removeIssued, { status: "idle" });
  useToast(state);
  useToast(removeState);
  useEffect(() => {
    if (state.status === "saved") setEditing(false);
  }, [state]);

  return (
    <li className="border-b py-2.5 last:border-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Link
          href={item.href}
          className="font-medium text-primary underline tabular-nums"
        >
          {item.number}
        </Link>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {item.description}
        </span>
        <Button
          type="button"
          onClick={() => setEditing((open) => !open)}
          variant="outline"
          size="sm"
          aria-expanded={editing}
        >
          Alterar número
        </Button>
        <ConfirmAction
          action={remove}
          pending={removing}
          error={removeState.status === "error" ? removeState.message : null}
          trigger="Excluir"
          question={`Excluir ${item.number}?`}
          consequence="Sai das listas e o número fica livre (bom para um documento de teste). O registro continua guardado, com a auditoria."
          confirmLabel="Excluir"
          pendingLabel="Excluindo..."
        >
          <input type="hidden" name="series" value={series} />
          <input type="hidden" name="id" value={item.id} />
        </ConfirmAction>
      </div>
      {editing && (
        <form
          action={action}
          className="mt-2.5 grid grid-cols-2 items-end gap-2.5 rounded-lg bg-muted/50 p-3 md:grid-cols-[110px_100px_1fr_auto]"
        >
          <input type="hidden" name="series" value={series} />
          <input type="hidden" name="id" value={item.id} />
          <Label className="flex-col items-stretch gap-1.5">
            <span>Nº de ordem</span>
            <Input
              name="sequence"
              type="number"
              min={1}
              defaultValue={item.sequence}
              className="font-normal"
            />
          </Label>
          <Label className="flex-col items-stretch gap-1.5">
            <span>Ano</span>
            <Input
              name="year"
              type="number"
              min={2000}
              max={2100}
              defaultValue={item.year}
              className="font-normal"
            />
          </Label>
          <Label className="col-span-2 flex-col items-stretch gap-1.5 md:col-span-1">
            <span>Motivo (vai para a auditoria)</span>
            <Input
              name="justificativa"
              required
              placeholder="Ex.: seguir a numeração do livro"
              className="font-normal"
            />
          </Label>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Salvar"}
          </Button>
          {state.status === "error" && (
            <p role="alert" className="col-span-full text-sm text-destructive">
              {state.message}
            </p>
          )}
        </form>
      )}
    </li>
  );
}

/**
 * The documents of a series issued in the year, to renumber by hand or to
 * exclude (a test): the number comes free for the next one.
 */
export function IssuedList({
  series,
  year,
  items,
}: {
  series: "guia" | "declaracao-iss";
  year: number;
  items: IssuedItem[];
}) {
  return (
    <details className="mt-3 rounded-lg border px-3.5 py-2">
      <summary className="cursor-pointer text-sm font-medium text-foreground">
        Emitidos em {year} ({items.length}): alterar número ou excluir
      </summary>
      {items.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">
          Nenhum emitido neste ano.
        </p>
      ) : (
        <ul className="mt-1">
          {items.map((item) => (
            <IssuedRow key={item.id} series={series} item={item} />
          ))}
        </ul>
      )}
    </details>
  );
}

/** Drops the number set by hand for the year: counting goes back to auto. */
export function ClearNumbering({
  series,
  year,
}: {
  series: string;
  year: number;
}) {
  const [state, action, pending] = useActionState<NumberingState, FormData>(
    clearNumbering,
    { status: "idle" },
  );
  useToast(state);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="series" value={series} />
      <input type="hidden" name="year" value={year} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-medium text-primary underline"
      >
        {pending ? "Voltando..." : `Voltar ao automático em ${year}`}
      </button>
    </form>
  );
}
