"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import { Label } from "../../../_ui/label.tsx";
import { Switch } from "../../../_ui/switch.tsx";
import { type HoursState, saveAccessWindow } from "./actions.ts";

const IDLE: HoursState = { status: "idle" };

export function WindowForm({
  enabled,
  start,
  end,
}: {
  enabled: boolean;
  start: string;
  end: string;
}) {
  const [state, action, pending] = useActionState(saveAccessWindow, IDLE);
  useEffect(() => {
    if (state.status === "saved") toast.success(state.message);
  }, [state]);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
      <Label className="h-9 font-normal text-foreground">
        <Switch name="enabled" defaultChecked={enabled} />
        Limitar o acesso ao horário
      </Label>
      <Label className="flex-col items-stretch gap-1.5 text-foreground">
        Abre às
        <Input
          type="time"
          name="start"
          defaultValue={start}
          className="font-normal"
        />
      </Label>
      <Label className="flex-col items-stretch gap-1.5 text-foreground">
        Fecha às
        <Input
          type="time"
          name="end"
          defaultValue={end}
          className="font-normal"
        />
      </Label>
      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar horário"}
      </Button>
      {state.status === "error" && (
        <p role="alert" className="basis-full text-sm text-destructive">
          {state.message}
        </p>
      )}
    </form>
  );
}
