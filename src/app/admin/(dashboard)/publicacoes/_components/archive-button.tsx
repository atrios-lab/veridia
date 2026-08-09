"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { type ArchiveState, archivePublicationAction } from "../actions.ts";

export function ArchiveButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState<ArchiveState, FormData>(
    archivePublicationAction,
    { status: "idle" },
  );

  useEffect(() => {
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="flex-none rounded-lg border border-admin-input-border px-3 py-1.5 text-[11.5px] font-bold text-admin-muted disabled:opacity-70"
      >
        {pending ? "Arquivando…" : "Arquivar agora"}
      </button>
    </form>
  );
}
