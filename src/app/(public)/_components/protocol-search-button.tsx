"use client";

import { useState } from "react";

export function ProtocolSearchButton({
  className = "rounded-[9px] px-4 py-2.5 md:px-6",
}: {
  className?: string;
}) {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="submit"
      disabled={pending}
      // Disabling the button synchronously in its own click handler cancels
      // the browser's default submit before it starts — the state update
      // has to land on the next tick, after the navigation is underway.
      onClick={() => setTimeout(() => setPending(true), 0)}
      className={`bg-brand-primary text-sm font-semibold text-white hover:bg-brand-primary-soft disabled:opacity-70 ${className}`}
    >
      {pending ? "Buscando..." : "Consultar"}
    </button>
  );
}
