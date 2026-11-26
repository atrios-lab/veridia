"use client";

import { useActionState } from "react";
import { Button } from "../../_ui/button.tsx";
import { Input } from "../../_ui/input.tsx";
import { Label } from "../../_ui/label.tsx";
import { closeProtocolDaysAction, type RiState } from "../actions.ts";
import { useRiToast } from "./client.tsx";

const IDLE: RiState = { status: "idle" };

/** Closes a span of days at once, each on its own date. */
export function CloseDaysForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(
    closeProtocolDaysAction,
    IDLE,
  );
  useRiToast(state);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="days-from">De</Label>
        <Input
          id="days-from"
          name="de"
          type="date"
          max={today}
          required
          className="bg-background"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="days-to">Até</Label>
        <Input
          id="days-to"
          name="ate"
          type="date"
          max={today}
          required
          className="bg-background"
        />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Encerrando…" : "Encerrar os dias do período"}
      </Button>
      {state.status === "error" && (
        <p role="alert" className="w-full text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}
    </form>
  );
}
