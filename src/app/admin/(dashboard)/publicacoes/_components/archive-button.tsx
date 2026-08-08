"use client";

import { useActionState } from "react";
import { type ArchiveState, archivePublicationAction } from "../actions.ts";

export function ArchiveButton({ id }: { id: string }) {
  const [, formAction, pending] = useActionState<ArchiveState, FormData>(
    archivePublicationAction,
    { status: "idle" },
  );

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
