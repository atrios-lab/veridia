"use client";

import { useEffect } from "react";
import { friendlyError } from "@/core/errors/friendly.ts";
import { Button } from "./_ui/button.tsx";

/** The panel failed outside a screen (its frame): same plain message. */
export default function AdminError({
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
    <main className="mx-auto flex min-h-screen max-w-[560px] flex-col justify-center gap-4 px-4">
      <h1 className="text-xl font-semibold text-foreground">
        {friendly.title}
      </h1>
      <p className="text-sm text-muted-foreground">{friendly.explanation}</p>
      {error.digest && (
        <p className="text-xs text-muted-foreground">
          Código para o suporte:{" "}
          <span className="font-mono">{error.digest}</span>
        </p>
      )}
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
