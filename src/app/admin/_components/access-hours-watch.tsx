"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * An open panel follows the hours too: ten minutes before they end the
 * person is told, and at the end the screen reloads into the closed one
 * (decision of 11/11/2026).
 */
export function AccessHoursWatch({ closesAt }: { closesAt: string }) {
  useEffect(() => {
    const end = new Date(closesAt).getTime();
    const left = end - Date.now();
    const timers: ReturnType<typeof setTimeout>[] = [];
    const time = new Date(closesAt).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
    if (left > 10 * 60_000) {
      timers.push(
        setTimeout(
          () =>
            toast.warning(
              `O acesso ao painel termina às ${time}. Salve o que estiver fazendo.`,
              { duration: 60_000 },
            ),
          left - 10 * 60_000,
        ),
      );
    }
    // Browsers cap timers at ~24.8 days; an end that far is not an end.
    if (left > 0 && left < 2 ** 31 - 1) {
      timers.push(setTimeout(() => window.location.reload(), left + 1000));
    }
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [closesAt]);
  return null;
}
