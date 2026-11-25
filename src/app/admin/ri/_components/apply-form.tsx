"use client";

import { useActionState } from "react";
import { Button } from "../../_ui/button.tsx";
import { Input } from "../../_ui/input.tsx";
import { Label } from "../../_ui/label.tsx";
import { applyReadingAction, type RiState } from "../actions.ts";

const IDLE: RiState = { status: "idle" };

export interface ApplyAct {
  seq: number;
  label: string;
  nature: string;
  date: string;
  parties: string;
  summary: string;
  exists: boolean;
}

/** The lançamentos read, chosen one by one, and the button that saves. */
export function ApplyForm({
  fileId,
  number,
  book,
  isNew,
  acts,
}: {
  fileId: string;
  number: number | null;
  book: 2 | 3;
  isNew: boolean;
  acts: ApplyAct[];
}) {
  const [state, action, pending] = useActionState(applyReadingAction, IDLE);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="fileId" value={fileId} />
      {isNew && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="apply-number">Número</Label>
            <Input
              id="apply-number"
              name="number"
              inputMode="numeric"
              required
              defaultValue={number ?? ""}
              className="bg-background"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="apply-book">Livro</Label>
            <select
              id="apply-book"
              name="book"
              defaultValue={String(book)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="2">Livro 2 · Registro Geral</option>
              <option value="3">Livro 3 · Registro Auxiliar</option>
            </select>
          </div>
        </div>
      )}
      {acts.length > 0 && (
        <ul className="flex flex-col gap-2">
          {acts.map((act) => (
            <li key={act.seq} className="rounded-lg border bg-background p-3">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name="seqs"
                  value={act.seq}
                  defaultChecked={!act.exists}
                  disabled={act.exists}
                  className="mt-1 size-4 flex-none"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    {act.label} {act.nature}
                    {act.exists && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        já está no sistema
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {[act.date, act.parties].filter(Boolean).join(" · ")}
                  </span>
                  <span className="mt-1 block text-xs whitespace-pre-line text-foreground">
                    {act.summary.slice(0, 600)}
                    {act.summary.length > 600 ? "…" : ""}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {state.status === "error" && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending
            ? "Salvando…"
            : isNew
              ? "Conferi: criar a matrícula com o que está marcado"
              : "Conferi: completar a matrícula com o que está marcado"}
        </Button>
      </div>
    </form>
  );
}
