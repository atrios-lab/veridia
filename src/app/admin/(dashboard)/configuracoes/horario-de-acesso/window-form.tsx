"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { type HoursState, saveAccessWindow } from "./actions.ts";

const IDLE: HoursState = { status: "idle" };
const FIELD =
  "rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3 py-2 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";

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
      <label className="flex items-center gap-2 text-[13px] text-admin-text">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={enabled}
          className="checkbox-admin"
        />
        Limitar o acesso ao horário
      </label>
      <label className="flex flex-col gap-1 text-xs font-bold text-admin-primary">
        Abre às
        <input
          type="time"
          name="start"
          defaultValue={start}
          className={FIELD}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-bold text-admin-primary">
        Fecha às
        <input type="time" name="end" defaultValue={end} className={FIELD} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="btn btn-admin-primary btn-md"
      >
        {pending ? "Salvando..." : "Salvar horário"}
      </button>
      {state.status === "error" && (
        <p
          role="alert"
          className="basis-full text-[12.5px] font-semibold text-admin-error-text"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
