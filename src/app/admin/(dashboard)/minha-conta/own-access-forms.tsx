"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../../_ui/button.tsx";
import { Input } from "../../_ui/input.tsx";
import { Label } from "../../_ui/label.tsx";
import {
  confirmOwnEmail,
  forgetOwnComputers,
  type OwnAccessState,
  requestOwnEmail,
} from "./actions.ts";

const IDLE: OwnAccessState = { status: "idle" };
function keep(dispatch: (data: FormData) => void) {
  return (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  };
}

export function OwnAccessForms({
  accountEmail,
  ownEmail,
}: {
  accountEmail: string;
  ownEmail: string;
}) {
  const [email, setEmail] = useState(ownEmail);
  const [requested, request, requesting] = useActionState(
    requestOwnEmail,
    IDLE,
  );
  const [confirmed, confirm, confirming] = useActionState(
    confirmOwnEmail,
    IDLE,
  );
  const [forgot, forget, forgetting] = useActionState(forgetOwnComputers, IDLE);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  useEffect(() => {
    if (requested.status === "code-sent") setPendingEmail(requested.email);
    if (requested.status === "saved") {
      toast.success(requested.message);
      setPendingEmail(null);
    }
  }, [requested]);
  useEffect(() => {
    if (confirmed.status === "saved") {
      toast.success(confirmed.message);
      setPendingEmail(null);
    }
  }, [confirmed]);
  useEffect(() => {
    if (forgot.status === "saved") toast.success(forgot.message);
  }, [forgot]);

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card px-5 py-4">
      <form onSubmit={keep(request)} className="flex flex-wrap items-end gap-2">
        <Label className="min-w-0 flex-1 flex-col items-stretch gap-1.5 text-foreground">
          Meu e-mail de verificação
          <Input
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={`${accountEmail} (o da conta)`}
            className="font-normal"
          />
        </Label>
        <Button type="submit" disabled={requesting}>
          {requesting
            ? "Enviando..."
            : email.trim()
              ? "Enviar código ao novo e-mail"
              : "Usar o e-mail da conta"}
        </Button>
        {ownEmail && (
          <Button
            type="button"
            disabled={requesting}
            onClick={() => {
              setEmail("");
              startTransition(() => request(new FormData()));
            }}
            variant="outline"
          >
            Apagar
          </Button>
        )}
      </form>
      {requested.status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {requested.message}
        </p>
      )}

      {pendingEmail && (
        <form
          onSubmit={keep(confirm)}
          className="rounded-lg bg-muted/50 px-3.5 py-3"
        >
          <input type="hidden" name="email" value={pendingEmail} />
          <p className="text-sm text-foreground">
            Enviamos um código para{" "}
            <strong>
              {requested.status === "code-sent" ? requested.to : pendingEmail}
            </strong>
            . Informe-o para confirmar o novo e-mail.
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <Input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              placeholder="000 000"
              required
              aria-label="Código enviado ao novo e-mail"
              className="w-40 text-center tabular-nums"
            />
            <Button type="submit" disabled={confirming}>
              {confirming ? "Conferindo..." : "Confirmar"}
            </Button>
          </div>
          {confirmed.status === "error" && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {confirmed.message}
            </p>
          )}
        </form>
      )}

      <form onSubmit={keep(forget)} className="border-t pt-3">
        <button
          type="submit"
          disabled={forgetting}
          className="text-xs font-medium text-muted-foreground underline hover:text-foreground"
        >
          {forgetting
            ? "Aplicando..."
            : "Pedir o código de novo nos meus dispositivos salvos"}
        </button>
      </form>
    </section>
  );
}
