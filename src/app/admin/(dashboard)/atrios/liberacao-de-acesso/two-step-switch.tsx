"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
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
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${on ? "bg-admin-success-bg text-admin-success-text" : "bg-admin-warning-bg text-admin-warning-text"}`}
        >
          {on ? "Duas etapas ligada" : "Duas etapas desligada"}
        </span>
        {on ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => setAsking((value) => !value)}
            className="btn btn-admin-secondary btn-sm"
          >
            Desligar
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => send("on")}
            className="btn btn-admin-primary btn-sm"
          >
            {pending ? "Ligando..." : "Ligar"}
          </button>
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
          <input
            name="reason"
            maxLength={300}
            placeholder="Motivo (ex.: e-mail fora do ar)"
            aria-label={`Motivo para desligar em ${name}`}
            className="w-60 rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3 py-1.5 text-[12.5px] text-admin-text outline-none focus:border-admin-primary-soft"
          />
          <button
            type="submit"
            disabled={pending}
            className="btn btn-admin-primary btn-sm"
          >
            {pending ? "Desligando..." : `Confirmar: desligar em ${name}`}
          </button>
        </form>
      )}
      {state.status === "error" && (
        <p
          role="alert"
          className="text-[12px] font-semibold text-admin-error-text"
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
