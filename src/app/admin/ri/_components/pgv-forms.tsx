"use client";

import { useActionState } from "react";
import { Button } from "../../_ui/button.tsx";
import { Input } from "../../_ui/input.tsx";
import {
  importPgvReturnAction,
  type RiState,
  savePgvCredentialAction,
} from "../actions.ts";
import { useRiToast } from "./client.tsx";

const IDLE: RiState = { status: "idle" };

/** Imports the file the PGV-CNM gives back and marks what is there. */
export function PgvImportForm() {
  const [state, action, pending] = useActionState(importPgvReturnAction, IDLE);
  useRiToast(state);
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="pgv-file" className="text-xs font-medium">
        Arquivo baixado do PGV-CNM (CSV, planilha salva como CSV, TXT, XML ou
        JSON)
      </label>
      <input
        id="pgv-file"
        name="file"
        type="file"
        required
        accept=".csv,.txt,.xml,.json"
        className="text-xs file:mr-2 file:rounded-md file:border file:bg-background file:px-2 file:py-1"
      />
      {state.status === "error" && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p className="text-xs text-foreground">{state.message}</p>
      )}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Lendo…" : "Importar o retorno do PGV"}
        </Button>
      </div>
    </form>
  );
}

/** The Client ID and the Hash of pgv.cnm › Integrações › Acesso à API. */
export function PgvCredentialForm({
  clientId,
  hasHash,
}: {
  clientId: string;
  hasHash: boolean;
}) {
  const [state, action, pending] = useActionState(
    savePgvCredentialAction,
    IDLE,
  );
  useRiToast(state);
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="pgv-client" className="text-xs font-medium">
        Client ID
      </label>
      <Input
        id="pgv-client"
        name="clientId"
        defaultValue={clientId}
        autoComplete="off"
      />
      <label htmlFor="pgv-hash" className="text-xs font-medium">
        Hash
      </label>
      <Input
        id="pgv-hash"
        name="hash"
        type="password"
        autoComplete="new-password"
        placeholder={
          hasHash
            ? "Guardado. Deixe em branco para manter, ou cole um novo."
            : "Cole aqui o Hash copiado do PGV"
        }
      />
      {state.status === "error" && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {state.message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Salvando…" : hasHash ? "Alterar credencial" : "Salvar"}
        </Button>
        {(clientId || hasHash) && (
          <Button
            type="submit"
            size="sm"
            variant="outline"
            name="op"
            value="clear"
            disabled={pending}
            onClick={(e) => {
              if (
                !window.confirm(
                  "Apagar a credencial do PGV-CNM? O cartório pode gerar outra no PGV quando quiser.",
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            Apagar
          </Button>
        )}
      </div>
    </form>
  );
}
