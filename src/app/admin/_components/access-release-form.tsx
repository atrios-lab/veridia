"use client";

import { useActionState } from "react";
import { LONG_TEXT_MAX, MIN_JUSTIFICATION } from "@/core/text-limits.ts";
import { Button } from "../_ui/button.tsx";
import { Label } from "../_ui/label.tsx";
import { Textarea } from "../_ui/textarea.tsx";
import {
  type ReleaseRequestState,
  requestAccessRelease,
} from "./access-hours-actions.ts";

const IDLE: ReleaseRequestState = { status: "idle" };

export function AccessReleaseForm({ pending }: { pending: boolean }) {
  const [state, action, sending] = useActionState(requestAccessRelease, IDLE);
  if (state.status === "sent" || (pending && state.status === "idle")) {
    return (
      <p className="mt-3 rounded-lg border border-success/30 bg-success-soft px-4 py-3 text-sm font-medium text-success-text">
        Pedido enviado ao Tabelião/Registrador. Quando ele liberar, é só
        recarregar esta página.
      </p>
    );
  }
  return (
    <form action={action} className="mt-3 flex flex-col gap-2">
      <Label htmlFor="reason">Qual demanda você precisa acompanhar?</Label>
      <Textarea
        id="reason"
        name="reason"
        rows={3}
        required
        minLength={MIN_JUSTIFICATION}
        maxLength={LONG_TEXT_MAX}
        placeholder="Ex.: conferir o protocolo de uma escritura com prazo amanhã cedo."
      />
      {state.status === "error" && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={sending} className="self-start">
        {sending ? "Enviando..." : "Pedir liberação ao Tabelião/Registrador"}
      </Button>
    </form>
  );
}
