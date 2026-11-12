"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { Button } from "../_ui/button.tsx";
import { cn } from "../_ui/cn.ts";
import { Input } from "../_ui/input.tsx";
import { Label } from "../_ui/label.tsx";
import {
  type AccessCodeState,
  confirmAccessCodeAction,
  sendAccessCodeAction,
} from "./actions.ts";

const IDLE: AccessCodeState = { status: "idle" };

export function AccessCodeForm({ next }: { next: string }) {
  const [sent, send, sending] = useActionState(sendAccessCodeAction, IDLE);
  const [checked, confirm, confirming] = useActionState(
    confirmAccessCodeAction,
    IDLE,
  );
  const asked = useRef(false);

  // The code goes out as the screen opens: one click less, every sign-in.
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    startTransition(() => send(new FormData()));
  }, [send]);

  return (
    <>
      <p
        aria-live="polite"
        className={cn(
          "mt-4 rounded-lg border px-4 py-3 text-sm",
          sent.status === "error"
            ? "border-destructive/40 bg-destructive-soft font-medium text-destructive"
            : "bg-muted/50 text-foreground",
        )}
      >
        {sending
          ? "Enviando o código..."
          : sent.status === "sent"
            ? `Enviamos um código de 6 dígitos para ${sent.to}. Ele vale por 10 minutos.`
            : sent.status === "error"
              ? sent.message
              : "Preparando o código..."}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(() => confirm(data));
        }}
        className="mt-4 flex flex-col gap-3"
      >
        <input type="hidden" name="next" value={next} />
        <Label htmlFor="codigo-acesso">Código de acesso</Label>
        <Input
          id="codigo-acesso"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          placeholder="000 000"
          required
          // The only field of the screen, reached right after the password.
          autoFocus
          className="h-12 text-center text-xl tracking-widest tabular-nums md:text-xl"
        />
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="salvar"
            className="checkbox-admin mt-0.5"
          />
          <span>
            Salvar este dispositivo: não pedir o código de novo aqui.
            <span className="block text-xs text-muted-foreground">
              Só no seu celular ou computador, ou num da serventia; nunca em
              aparelho público.
            </span>
          </span>
        </label>
        {checked.status === "error" && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {checked.message}
          </p>
        )}
        <Button type="submit" size="lg" disabled={confirming}>
          {confirming ? "Conferindo..." : "Entrar"}
        </Button>
        <Button
          type="button"
          variant="link"
          disabled={sending}
          onClick={() => startTransition(() => send(new FormData()))}
          className="underline"
        >
          Reenviar código
        </Button>
      </form>
    </>
  );
}
