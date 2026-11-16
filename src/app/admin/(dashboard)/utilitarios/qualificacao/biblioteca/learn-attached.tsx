"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AdminIcon } from "../../../../_components/icon.tsx";
import { Button } from "../../../../_ui/button.tsx";
import { Spinner } from "../../../../_ui/spinner.tsx";
import { type LearnState, learnNextAttachedAction } from "../actions.ts";

type Done = NonNullable<Extract<LearnState, { status: "success" }>["item"]>;

/**
 * Learning from the notes already attached (decision of 16/11/2026): one
 * note per call, so the clerk sees each one go by and can stop at any
 * moment; the notes with something to check are listed with their request.
 */
export function LearnAttached({
  pending,
  usesAi,
}: {
  pending: number;
  /** The office's mode reads with the AI (credit); else the base alone. */
  usesAi: boolean;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(pending);
  const [done, setDone] = useState<Done[]>([]);
  const [error, setError] = useState("");
  const stop = useRef(false);

  const run = async () => {
    stop.current = false;
    setError("");
    setRunning(true);
    while (!stop.current) {
      const result = await learnNextAttachedAction().catch(() => ({
        status: "error" as const,
        message: "Não foi possível continuar agora. Tente de novo.",
      }));
      if (result.status === "error") {
        setError(result.message);
        break;
      }
      setRemaining(result.remaining);
      const item = result.item;
      if (item) setDone((list) => [item, ...list].slice(0, 200));
      if (result.done || !item) break;
    }
    setRunning(false);
    router.refresh();
  };

  const learnedTotal = done.reduce((sum, d) => sum + d.learned, 0);
  const flagged = done.filter((d) => d.findings > 0);

  return (
    <section className="rounded-xl border bg-card p-5 shadow-xs">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-base font-semibold text-foreground">
            Aprender com as notas já anexadas
          </h2>
          <p className="text-sm text-muted-foreground">
            {usesAi
              ? "O Assistente Virtual lê as notas e documentos que a equipe já anexou às exigências, aponta o que diverge da lei ou cita norma revogada e guarda aqui os modelos de exigência"
              : "As notas e documentos que a equipe já anexou às exigências são lidos pela base jurídica da serventia, sem gastar crédito da IA: aponta norma ou artigo revogado e exigência sem fundamento, e guarda aqui os modelos de exigência"}
            , sem dados pessoais, marcados como <strong>Aprendida</strong>. Toda
            nota nova anexada passa por isso sozinha.
          </p>
        </div>
        {running ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              stop.current = true;
            }}
          >
            Parar
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={remaining === 0}
            onClick={() => void run()}
          >
            {remaining === 0 ? "Nada a aprender" : "Aprender agora"}
          </Button>
        )}
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm text-foreground">
        {running && <Spinner className="size-4 text-primary" />}
        {remaining === 0
          ? "Todas as notas anexadas já foram lidas."
          : `${remaining} ${remaining === 1 ? "nota ainda não lida" : "notas ainda não lidas"}.`}
        {done.length > 0 &&
          ` Nesta leitura: ${done.length} lida(s), ${learnedTotal} modelo(s) aprendido(s).`}
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {flagged.length > 0 && (
        <div className="mt-3 rounded-lg border border-warning/40 bg-warning-soft p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-warning-text">
            <AdminIcon name="alert" className="size-4" strokeWidth={2} />
            Notas com pontos a conferir
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {flagged.map((d) => (
              <li key={`${d.protocolNumber}-${d.fileName}`}>
                <Link
                  href={`/admin/pedidos/${encodeURIComponent(d.protocolNumber)}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {d.protocolNumber}
                </Link>{" "}
                · {d.fileName}: {d.headline.toLowerCase()}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Abra o pedido: a análise aparece embaixo do documento, na exigência.
            A decisão de corrigir é sua.
          </p>
        </div>
      )}
    </section>
  );
}
