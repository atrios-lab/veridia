"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "../../_ui/button.tsx";
import { Input } from "../../_ui/input.tsx";
import { Label } from "../../_ui/label.tsx";
import { changeOwnPassword, type PasswordState } from "./actions.ts";

/** Trocar a própria senha: the current one, the new one twice. */
export function PasswordForm({ changed }: { changed: boolean }) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(
    changeOwnPassword,
    { status: "idle" },
  );
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status !== "saved") return;
    toast.success(state.message);
    form.current?.reset();
  }, [state]);

  return (
    <section id="senha" className="rounded-xl border bg-card px-5 py-4">
      <h2 className="text-lg font-semibold text-foreground">
        Trocar minha senha
      </h2>
      {changed && (
        <output className="mt-2 block rounded-lg border border-success/30 bg-success-soft px-4 py-3 text-sm font-medium text-success-text">
          Senha trocada. Nos outros dispositivos, entre de novo com a senha
          nova.
        </output>
      )}
      <p className="mt-1 text-sm text-muted-foreground">
        Informe a senha atual e a nova, com pelo menos 8 caracteres. Os outros
        dispositivos onde você está conectado saem e pedem a senha nova.
      </p>
      <form
        ref={form}
        // Not `action={action}`: React would clear the fields after a wrong
        // current password, and the new one would have to be typed again.
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(() => action(data));
        }}
        className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3"
      >
        <Label className="flex-col items-stretch gap-1.5">
          Senha atual
          <Input
            name="atual"
            type="password"
            autoComplete="current-password"
            required
            className="font-normal"
          />
        </Label>
        <Label className="flex-col items-stretch gap-1.5">
          Nova senha
          <Input
            name="nova"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="font-normal"
          />
        </Label>
        <Label className="flex-col items-stretch gap-1.5">
          Repita a nova senha
          <Input
            name="confirmar"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="font-normal"
          />
        </Label>
        <div className="md:col-span-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Trocando..." : "Trocar senha"}
          </Button>
          {state.status === "error" && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {state.message}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
