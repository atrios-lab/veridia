"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Role } from "@/core/auth/roles.ts";
import { ROLE_LABELS } from "../../../_components/role-labels.ts";
import { Button } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import { Label } from "../../../_ui/label.tsx";
import { type AccessState, forgetComputers, saveCodeEmail } from "./actions.ts";

const IDLE: AccessState = { status: "idle" };

function submitKeeping(dispatch: (data: FormData) => void) {
  return (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  };
}

export function AccountAccessRow({
  userId,
  name,
  role,
  accountEmail,
  codeEmail,
  sendsTo,
}: {
  userId: string;
  name: string;
  role: string;
  accountEmail: string;
  codeEmail: string;
  sendsTo: string;
}) {
  const [email, setEmail] = useState(codeEmail);
  const [saved, save, saving] = useActionState(saveCodeEmail, IDLE);
  const [forgot, forget, forgetting] = useActionState(forgetComputers, IDLE);
  useEffect(() => {
    if (saved.status === "saved") toast.success(saved.message);
  }, [saved]);
  useEffect(() => {
    if (forgot.status === "saved") toast.success(forgot.message);
  }, [forgot]);
  const error =
    saved.status === "error"
      ? saved.message
      : forgot.status === "error"
        ? forgot.message
        : null;

  return (
    <section className="rounded-xl border bg-card px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">{name}</h3>
        <span className="text-xs text-muted-foreground">
          {ROLE_LABELS[role as Role] ?? role} · conta {accountEmail}
        </span>
      </div>
      <p className="mt-1 text-xs text-foreground">
        O código vai para <strong>{sendsTo}</strong>.
      </p>
      <form
        onSubmit={submitKeeping(save)}
        className="mt-3 flex flex-wrap items-end gap-2"
      >
        <input type="hidden" name="userId" value={userId} />
        <Label className="min-w-0 flex-1 flex-col items-stretch gap-1.5 text-foreground">
          E-mail de verificação
          <Input
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={`${accountEmail} (o da conta)`}
            className="font-normal"
          />
        </Label>
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
        {codeEmail && (
          <Button
            type="button"
            disabled={saving}
            onClick={() => {
              setEmail("");
              const data = new FormData();
              data.set("userId", userId);
              data.set("email", "");
              startTransition(() => save(data));
            }}
            variant="outline"
          >
            Apagar
          </Button>
        )}
      </form>
      <form onSubmit={submitKeeping(forget)} className="mt-2.5">
        <input type="hidden" name="userId" value={userId} />
        <button
          type="submit"
          disabled={forgetting}
          className="text-xs font-medium text-muted-foreground underline hover:text-foreground"
        >
          {forgetting
            ? "Aplicando..."
            : "Pedir o código de novo nos dispositivos salvos"}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
