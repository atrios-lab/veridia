"use client";

import { useActionState } from "react";
import { TaxIdInput } from "../../_components/tax-id-input.tsx";
import { Button } from "../../_ui/button.tsx";
import { Input } from "../../_ui/input.tsx";
import { Label } from "../../_ui/label.tsx";
import { Textarea } from "../../_ui/textarea.tsx";
import { type RiState, savePersonAction } from "../actions.ts";

const IDLE: RiState = { status: "idle" };

export function PersonForm({
  person,
}: {
  person?: { id: string; name: string; document: string; notes: string };
}) {
  const [state, action, pending] = useActionState(savePersonAction, IDLE);
  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-xl border bg-card px-4 py-4 shadow-xs md:px-5"
    >
      {person && <input type="hidden" name="id" value={person.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="p-name">Nome completo ou razão social</Label>
          <Input
            id="p-name"
            name="name"
            required
            defaultValue={person?.name ?? ""}
            className="bg-background"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="p-document">CPF ou CNPJ</Label>
          <TaxIdInput
            id="p-document"
            name="document"
            defaultValue={person?.document ?? ""}
            className="bg-background"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="p-notes">Observações</Label>
        <Textarea
          id="p-notes"
          name="notes"
          rows={3}
          defaultValue={person?.notes ?? ""}
          className="field-sizing-fixed bg-background"
          placeholder="Ex.: estado civil, regime de bens, nome anterior."
        />
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p className="text-sm text-muted-foreground">{state.message}</p>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending
            ? "Salvando…"
            : person
              ? "Salvar alterações"
              : "Cadastrar pessoa"}
        </Button>
      </div>
    </form>
  );
}
