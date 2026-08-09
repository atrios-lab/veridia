"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { type ActionState, setStatusAction } from "../actions.ts";

const LABELS: Record<string, string> = {
  available: "Disponível",
  busy: "Ocupado",
  away: "Ausente",
};
const DOT_CLASS: Record<string, string> = {
  available: "bg-admin-success-text",
  busy: "bg-admin-warning-text",
  away: "bg-admin-faint",
};

export function StatusControl({ currentStatus }: { currentStatus: string }) {
  const [status, setStatus] = useState(currentStatus);
  const [state, formAction] = useActionState<ActionState, FormData>(
    setStatusAction,
    { status: "idle" },
  );

  useEffect(() => {
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  return (
    <form
      action={formAction}
      onChange={(event) => {
        const value = new FormData(event.currentTarget).get("status");
        if (typeof value === "string") setStatus(value);
      }}
      className="relative"
    >
      <select
        name="status"
        defaultValue={currentStatus}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="appearance-none rounded-lg border border-admin-input-border bg-admin-card py-1.5 pr-8 pl-7 text-[12.5px] font-bold text-admin-primary"
      >
        {Object.entries(LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute top-1/2 left-2.5 h-2 w-2 -translate-y-1/2 rounded-full ${DOT_CLASS[status] ?? DOT_CLASS.available}`}
      />
    </form>
  );
}
