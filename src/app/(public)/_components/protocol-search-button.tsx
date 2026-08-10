"use client";

import { useState } from "react";

/**
 * `h-11 py-0` and not just `btn-lg`: this button is half of a search row, and
 * the field beside it is 44px. At btn-lg's own height it stood 8px taller and
 * the pair stopped reading as one control.
 */
export function ProtocolSearchButton({
  className = "btn-lg h-11 py-0",
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
      className={`btn btn-primary ${className}`}
    >
      {pending ? "Buscando..." : "Consultar"}
    </button>
  );
}
