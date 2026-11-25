"use client";

import { startTransition, useActionState, useRef } from "react";
import { statusLabel } from "@/core/ri/sheet.ts";
import { Button } from "../../_ui/button.tsx";
import { type ImportState, importSheetAction } from "../actions.ts";

const IDLE: ImportState = { status: "idle" };

/**
 * The office's index, in two steps on the same form: "Conferir" reads it
 * and shows what would come in; "Importar" saves (decision of 25/11/2026:
 * nothing goes in without the conferência).
 */
export function ImportForm() {
  const [state, action, pending] = useActionState(importSheetAction, IDLE);
  const form = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={form}
      // Not `action={...}`: React clears the form after an action, and the
      // second step ("Importar") needs the file still chosen.
      onSubmit={(event) => {
        event.preventDefault();
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        const data = new FormData(event.currentTarget, submitter);
        startTransition(() => action(data));
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="ri-sheet" className="text-sm font-medium">
          Planilha do índice (.xlsx ou .csv)
        </label>
        <input
          id="ri-sheet"
          name="planilha"
          type="file"
          accept=".xlsx,.csv,text/csv"
          required
          className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium"
        />
        <p className="text-xs text-muted-foreground">
          Uma linha por matrícula. Os títulos das colunas são reconhecidos pelo
          nome: Matrícula, Situação, Proprietários, CPF/CNPJ, Denominação,
          Origem, Data de abertura, Tipo, Área, CNM, CCIR, NIRF, CAR,
          Logradouro, Bairro, Nº de atos, Observações. O que já está no sistema
          não entra de novo.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          name="intent"
          value="preview"
          variant="outline"
          disabled={pending}
        >
          {pending ? "Lendo…" : "Conferir a planilha"}
        </Button>
        {state.status === "preview" && (
          <Button type="submit" name="intent" value="import" disabled={pending}>
            {pending ? "Importando…" : `Importar ${state.total} matrícula(s)`}
          </Button>
        )}
      </div>

      {state.status === "error" && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}

      {state.status === "done" && (
        <div
          aria-live="polite"
          className="rounded-lg border border-success/40 bg-success-soft px-4 py-3 text-sm text-success-text"
        >
          <p className="font-semibold">
            {state.created} matrícula(s) importada(s).
          </p>
          {state.skipped.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-xs">
              {state.skipped.slice(0, 30).map((s) => (
                <li key={s.line}>
                  Linha {s.line}: {s.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {state.status === "preview" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            <span className="font-semibold">{state.fileName}</span>:{" "}
            {state.total} matrícula(s) lida(s)
            {state.total > state.rows.length
              ? `; mostrando as ${state.rows.length} primeiras`
              : ""}
            . Confira e depois clique em Importar.
          </p>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {state.columns.map((c) => (
              <span
                key={c.header}
                className={`rounded-full border px-2 py-0.5 ${c.field ? "bg-background" : "bg-warning-soft text-warning-text"}`}
              >
                {c.header} → {c.field || "ignorada"}
              </span>
            ))}
          </div>
          {state.errors.length > 0 && (
            <ul className="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning-text">
              {state.errors.slice(0, 20).map((e) => (
                <li key={e.line}>
                  Linha {e.line}: {e.message} (fica de fora)
                </li>
              ))}
            </ul>
          )}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-xl text-left text-xs">
              <thead className="border-b bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Linha</th>
                  <th className="px-2 py-1.5 font-medium">Matrícula</th>
                  <th className="px-2 py-1.5 font-medium">Situação</th>
                  <th className="px-2 py-1.5 font-medium">Proprietários</th>
                  <th className="px-2 py-1.5 font-medium">Imóvel</th>
                  <th className="px-2 py-1.5 font-medium">Avisos</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {state.rows.map((row) => (
                  <tr key={row.line}>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {row.line}
                    </td>
                    <td className="px-2 py-1.5 font-medium">
                      {row.number.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-2 py-1.5">
                      {statusLabel(row.situation)}
                    </td>
                    <td className="px-2 py-1.5">
                      {row.owners || "não informado"}
                    </td>
                    <td className="px-2 py-1.5">
                      {row.place || "não informado"}
                    </td>
                    <td className="px-2 py-1.5 text-warning-text">
                      {row.warnings.join("; ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </form>
  );
}
