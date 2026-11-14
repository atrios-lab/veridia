"use client";

import { useEffect } from "react";
import { friendlyError } from "@/core/errors/friendly.ts";
import { Button } from "../_ui/button.tsx";

/**
 * A screen of the panel that failed, in Portuguese and saying what it was
 * (decision of 14/11/2026). The sidebar stays: only the screen is replaced.
 */
export default function PanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("painel.erro", error);
  }, [error]);
  const friendly = friendlyError({
    message: error.message,
    online: typeof navigator === "undefined" ? undefined : navigator.onLine,
  });
  return (
    <main className="flex max-w-[720px] flex-col gap-4 px-4 py-10 md:px-8">
      <div className="rounded-xl border border-warning/30 bg-warning-soft p-6">
        <h1 className="text-lg font-semibold text-warning-text">
          {friendly.title}
        </h1>
        <p className="mt-2 text-sm text-warning-text">{friendly.explanation}</p>
        {error.digest && (
          <p className="mt-3 text-xs text-warning-text">
            Código para o suporte:{" "}
            <span className="font-mono">{error.digest}</span>
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => reset()}>
          Tentar de novo
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => window.history.back()}
        >
          Voltar
        </Button>
      </div>
    </main>
  );
}
