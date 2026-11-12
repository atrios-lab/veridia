"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { NativeSelect } from "../../../_ui/native-select.tsx";
import { type ActionState, setStatusAction } from "../actions.ts";

const LABELS: Record<string, string> = {
  available: "Disponível",
  busy: "Ocupado",
  away: "Ausente",
};
const DOT_CLASS: Record<string, string> = {
  available: "bg-success",
  busy: "bg-warning",
  away: "bg-muted-foreground",
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
      <NativeSelect
        name="status"
        size="sm"
        defaultValue={currentStatus}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="bg-background font-medium [&_select]:pl-7"
      >
        {Object.entries(LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </NativeSelect>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute top-1/2 left-2.5 h-2 w-2 -translate-y-1/2 rounded-full ${DOT_CLASS[status] ?? DOT_CLASS.available}`}
      />
    </form>
  );
}
