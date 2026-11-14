"use client";

import { useEffect } from "react";
import { friendlyError } from "@/core/errors/friendly.ts";

/**
 * The whole site failed (its own frame): it reads as maintenance (decision
 * of 14/11/2026: "se o site cair, dizer que está em manutenção"). Plain
 * styles: the stylesheets may be what failed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("site.fora", error);
  }, [error]);
  const friendly = friendlyError({
    message: error.message,
    online: typeof navigator === "undefined" ? undefined : navigator.onLine,
    whole: true,
  });
  return (
    <html lang="pt-BR">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          maxWidth: 560,
          margin: "15vh auto",
          padding: "0 16px",
          lineHeight: 1.5,
        }}
      >
        <h1 style={{ fontSize: 24 }}>{friendly.title}</h1>
        <p>{friendly.explanation}</p>
        {error.digest && (
          <p style={{ fontSize: 13, opacity: 0.75 }}>
            Código para o suporte: {error.digest}
          </p>
        )}
        <p style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => reset()}>
            Tentar de novo
          </button>
          <button type="button" onClick={() => window.history.back()}>
            Voltar
          </button>
        </p>
      </body>
    </html>
  );
}
