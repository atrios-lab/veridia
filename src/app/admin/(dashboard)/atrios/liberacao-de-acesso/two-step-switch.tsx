"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "../../../_ui/badge.tsx";
import { Button } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import { type ReleaseState, setTwoStep } from "./actions.ts";

const IDLE: ReleaseState = { status: "idle" };

export function TwoStepSwitch({
  slug,
  name,
  on,
}: {
  slug: string;
  name: string;
  on: boolean;
}) {
  const [state, action, pending] = useActionState(setTwoStep, IDLE);
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (state.status === "saved") {
      toast.success(state.message);
      setAsking(false);
    }
  }, [state]);

  const send = (twoStep: "on" | "off", reason = "") => {
    const data = new FormData();
    data.set("tenant", slug);
    data.set("twoStep", twoStep);
    data.set("reason", reason);
    startTransition(() => action(data));
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <Badge
          className={
            on
              ? "bg-success text-success-foreground"
              : "bg-warning text-warning-foreground"
          }
        >
          {on ? "Duas etapas ligada" : "Duas etapas desligada"}
        </Badge>
        {on ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => setAsking((value) => !value)}
          >
            Desligar
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => send("on")}
          >
            {pending ? "Ligando..." : "Ligar"}
          </Button>
        )}
      </div>
      {asking && on && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const reason = String(
              new FormData(event.currentTarget).get("reason") ?? "",
            );
            send("off", reason);
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <Input
            name="reason"
            maxLength={300}
            placeholder="Motivo (ex.: e-mail fora do ar)"
            aria-label={`Motivo para desligar em ${name}`}
            className="h-8 w-60 bg-background"
          />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Desligando..." : `Confirmar: desligar em ${name}`}
          </Button>
        </form>
      )}
      {state.status === "error" && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {state.message}
        </p>
      )}
    </div>
  );
}
