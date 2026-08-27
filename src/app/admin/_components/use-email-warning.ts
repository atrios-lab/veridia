"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Shows, once, that the citizen's e-mail did not go out because that address
 * does not take mail.
 *
 * A toast and not a line on the page: the record was saved, so nothing on
 * screen is wrong, and what changed is what the atendente should do next,
 * which is pick up the phone. It fires at the moment they tried to write and
 * nowhere else, on purpose: an address that bounces is not a property of the
 * pedido worth a permanent badge, it is a fact that matters exactly when
 * someone counts on that channel.
 */
export function useEmailWarning(state: {
  status: string;
  emailWarning?: string | null;
}) {
  const warning = state.status === "success" ? state.emailWarning : null;
  useEffect(() => {
    if (warning) toast.warning(warning, { duration: 10_000 });
  }, [warning]);
}
