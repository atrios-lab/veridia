"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import {
  clearNumbering,
  type NumberingState,
  removeIssued,
  renumberIssued,
} from "./actions.ts";

const FIELD =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3 py-2 text-[13px] text-admin-text outline-none focus:border-admin-primary-soft";
const LABEL = "mb-1 block text-[11.5px] font-bold text-admin-primary";

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
    <li className="border-b border-admin-border py-2.5 last:border-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Link
          href={item.href}
          className="font-semibold text-admin-primary underline"
        >
          {item.number}
        </Link>
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-admin-muted">
          {item.description}
        </span>
        <button
          type="button"
          onClick={() => setEditing((open) => !open)}
          className="btn btn-admin-secondary btn-sm"
          aria-expanded={editing}
        >
          Alterar número
        </button>
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
          className="mt-2.5 grid grid-cols-2 items-end gap-2.5 rounded-[10px] bg-admin-input-bg p-3 md:grid-cols-[110px_100px_1fr_auto]"
        >
          <input type="hidden" name="series" value={series} />
          <input type="hidden" name="id" value={item.id} />
          <label className="block">
            <span className={LABEL}>Nº de ordem</span>
            <input
              name="sequence"
              type="number"
              min={1}
              defaultValue={item.sequence}
              className={FIELD}
            />
          </label>
          <label className="block">
            <span className={LABEL}>Ano</span>
            <input
              name="year"
              type="number"
              min={2000}
              max={2100}
              defaultValue={item.year}
              className={FIELD}
            />
          </label>
          <label className="col-span-2 block md:col-span-1">
            <span className={LABEL}>Motivo (vai para a auditoria)</span>
            <input
              name="justificativa"
              required
              placeholder="Ex.: seguir a numeração do livro"
              className={FIELD}
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="btn btn-admin-primary btn-md"
          >
            {pending ? "Salvando..." : "Salvar"}
          </button>
          {state.status === "error" && (
            <p
              role="alert"
              className="col-span-full text-[12.5px] font-semibold text-admin-error-text"
            >
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
    <details className="mt-3 rounded-[10px] border border-admin-border px-3.5 py-2">
      <summary className="cursor-pointer text-[12.5px] font-semibold text-admin-primary">
        Emitidos em {year} ({items.length}): alterar número ou excluir
      </summary>
      {items.length === 0 ? (
        <p className="py-2 text-[12.5px] text-admin-muted">
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
        className="text-[12px] font-semibold text-admin-primary underline"
      >
        {pending ? "Voltando..." : `Voltar ao automático em ${year}`}
      </button>
    </form>
  );
}
