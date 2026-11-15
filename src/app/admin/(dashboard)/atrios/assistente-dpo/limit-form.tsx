"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import { type LimitState, setDpoLimit } from "./actions.ts";

const IDLE: LimitState = { status: "idle" };

export function LimitForm({
  slug,
  name,
  limit,
}: {
  slug: string;
  name: string;
  limit: number | null;
}) {
  const [state, action, pending] = useActionState(setDpoLimit, IDLE);
  useEffect(() => {
    if (state.status === "saved") toast.success(state.message);
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="tenant" value={slug} />
      <Input
        name="limit"
        type="number"
        min={1}
        inputMode="numeric"
        defaultValue={limit ?? ""}
        placeholder="300"
        aria-label={`Teto mensal de ${name}`}
        className="h-8 w-24"
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Salvar
      </Button>
    </form>
  );
}
