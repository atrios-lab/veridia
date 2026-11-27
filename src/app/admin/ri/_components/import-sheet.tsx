"use client";

import { useActionState } from "react";
import { Button } from "../../_ui/button.tsx";
import { Label } from "../../_ui/label.tsx";
import type { RiState } from "../actions.ts";
import { useRiToast } from "./client.tsx";

const IDLE: RiState = { status: "idle" };

/** Sends a spreadsheet (.xlsx, .csv, .ods) to an import action. */
export function ImportSheetForm({
  action,
  label,
}: {
  action: (previous: RiState, formData: FormData) => Promise<RiState>;
  label: string;
}) {
  const [state, dispatch, pending] = useActionState(action, IDLE);
  useRiToast(state);
  return (
    <form action={dispatch} className="flex flex-col gap-2">
      <Label htmlFor={`import-${label}`}>{label}</Label>
      <input
        id={`import-${label}`}
        type="file"
        name="arquivo"
        accept=".xlsx,.csv,.ods"
        required
        className="block w-full rounded-md border bg-background p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
      />
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Importando..." : "Importar"}
        </Button>
      </div>
      {state.status !== "idle" && (
        <p
          className={`text-sm ${state.status === "error" ? "text-destructive" : "text-muted-foreground"}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
