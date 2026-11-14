"use client";

import { useEffect } from "react";
import { friendlyError } from "@/core/errors/friendly.ts";

/** A page of the site that failed, in Portuguese (decision of 14/11/2026). */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("site.erro", error);
  }, [error]);
  const friendly = friendlyError({
    message: error.message,
    online: typeof navigator === "undefined" ? undefined : navigator.onLine,
  });
  return (
    <main className="mx-auto flex w-full max-w-[640px] flex-col gap-4 px-4 py-14">
      <h1 className="font-serif text-2xl font-semibold text-brand-primary">
        {friendly.title}
      </h1>
      <p className="text-sm leading-relaxed text-brand-muted">
        {friendly.explanation}
      </p>
      {error.digest && (
        <p className="text-xs text-brand-muted">
          Código para o atendimento:{" "}
          <span className="font-mono">{error.digest}</span>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white"
        >
          Tentar de novo
        </button>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="rounded-xl border border-brand-border px-4 py-2.5 text-sm font-semibold text-brand-primary"
        >
          Voltar
        </button>
      </div>
    </main>
  );
}
