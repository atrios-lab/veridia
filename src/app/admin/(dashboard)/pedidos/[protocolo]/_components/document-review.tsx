"use client";

import { useEffect, useRef, useState } from "react";
import {
  FINDING_LABELS,
  type ReviewFinding,
} from "@/core/qualificacao/revisao.ts";
import type { ReviewView } from "@/lib/qualificacao-revisao.ts";
import { AdminIcon } from "../../../../_components/icon.tsx";
import { Button } from "../../../../_ui/button.tsx";
import { Spinner } from "../../../../_ui/spinner.tsx";
import { reviewRequirementDocumentAction } from "../actions.ts";

export type ReviewStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; review: ReviewView }
  | { kind: "failed"; message: string };

/**
 * The review of the note picked for an exigência (decision of 16/11/2026),
 * started as soon as the file is chosen, side by side with the check of
 * the signature, so the clerk waits once.
 */
export function useDocumentReview(requestId: string) {
  const [status, setStatus] = useState<ReviewStatus>({ kind: "idle" });
  const [decision, setDecision] = useState<"" | "manteve" | "alterou">("");
  // A file picked again before the first answer came: only the last counts.
  const turn = useRef(0);
  const start = async (file: File) => {
    const mine = ++turn.current;
    setDecision("");
    setStatus({ kind: "loading" });
    const data = new FormData();
    data.set("requestId", requestId);
    data.set("formulario", file);
    const result = await reviewRequirementDocumentAction(data).catch(() => ({
      status: "error" as const,
      message:
        "Não foi possível analisar o documento agora. Você pode enviar assim mesmo.",
    }));
    if (mine !== turn.current) return;
    setStatus(
      result.status === "success"
        ? { kind: "done", review: result.review }
        : {
            kind: "failed",
            message:
              result.status === "error"
                ? result.message
                : "Não foi possível analisar o documento.",
          },
    );
  };
  const reset = () => {
    turn.current += 1;
    setStatus({ kind: "idle" });
    setDecision("");
  };
  /** The clerk may go on: nothing to decide, or decided to keep it. */
  const cleared =
    status.kind === "failed" ||
    (status.kind === "done" &&
      (status.review.result.findings.length === 0 || decision === "manteve"));
  return { status, decision, setDecision, start, reset, cleared };
}

const STEPS = [
  "Lendo a exigência…",
  "Conferindo as normas citadas na base jurídica…",
  "Buscando o fundamento na lei e nas normas em vigor…",
  "Preparando a sugestão…",
];

/** What the clerk sees while the note is read: it moves, so it is alive. */
function Analysing() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(
      () => setStep((s) => Math.min(s + 1, STEPS.length - 1)),
      3500,
    );
    return () => clearInterval(timer);
  }, []);
  return (
    <output className="mt-3 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
      <Spinner className="size-4 flex-none text-primary" />
      <span className="flex flex-col gap-0.5">
        <span className="font-medium">Analisando a exigência</span>
        <span className="text-xs text-muted-foreground">{STEPS[step]}</span>
      </span>
    </output>
  );
}

function Finding({ finding }: { finding: ReviewFinding }) {
  const serious = finding.kind === "revogada" || finding.kind === "divergente";
  return (
    <li
      className={`rounded-md border px-3 py-2 ${serious ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning-soft"}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${serious ? "bg-destructive/10 text-destructive" : "bg-warning/20 text-warning-text"}`}
        >
          {FINDING_LABELS[finding.kind]}
        </span>
        <span className="text-xs text-muted-foreground">
          {finding.source === "base"
            ? "pela base jurídica da serventia"
            : "pelo Assistente Virtual"}
        </span>
      </div>
      {finding.excerpt && (
        <p className="mt-1.5 border-l-2 border-muted-foreground/30 pl-2 text-xs text-muted-foreground italic">
          “{finding.excerpt}”
        </p>
      )}
      <p className="mt-1.5 text-sm text-foreground">{finding.problem}</p>
      {finding.basis && (
        <p className="mt-1 text-xs text-foreground">
          <span className="font-semibold">Fundamento:</span> {finding.basis}
          {finding.url && (
            <>
              {" · "}
              <a
                href={finding.url}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary underline underline-offset-4"
              >
                ver na fonte oficial
              </a>
            </>
          )}
        </p>
      )}
      {finding.suggestion && (
        <p className="mt-1 text-xs text-foreground">
          <span className="font-semibold">Sugestão:</span> {finding.suggestion}
        </p>
      )}
    </li>
  );
}

/** The findings, the suggestion and the clerk's call. */
export function DocumentReviewPanel({
  status,
  decision,
  onKeep,
  onChange,
}: {
  status: ReviewStatus;
  decision: "" | "manteve" | "alterou";
  /** "Manter e enviar": the signature question comes next. */
  onKeep: () => void;
  /** "Alterar antes de enviar": nothing goes; the file is dropped. */
  onChange: () => void;
}) {
  if (status.kind === "idle") return null;
  if (status.kind === "loading") return <Analysing />;
  if (status.kind === "failed") {
    return (
      <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
        {status.message}
      </p>
    );
  }
  const { review } = status;
  const { findings } = review.result;
  const clean = findings.length === 0;
  return (
    <div
      className={`mt-3 rounded-lg border p-4 text-sm ${clean ? "border-success/30 bg-success-soft" : "border-warning/40 bg-background"}`}
    >
      <div className="flex items-center gap-2">
        <AdminIcon
          name={clean ? "check" : "alert"}
          className={`size-4 flex-none ${clean ? "text-success-text" : "text-warning-text"}`}
          strokeWidth={2}
        />
        <span
          className={`font-semibold ${clean ? "text-success-text" : "text-foreground"}`}
        >
          {review.headline}
        </span>
        {!clean && (
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            Sugestão:{" "}
            {review.result.recommendation === "alterar"
              ? "alterar antes de enviar"
              : "pode manter"}
          </span>
        )}
      </div>
      {review.result.summary && (
        <p className="mt-1.5 text-sm text-foreground">
          {review.result.summary}
        </p>
      )}
      {review.aiError && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {review.aiError} A conferência foi feita só pela base jurídica da
          serventia.
        </p>
      )}
      {!clean && (
        <ul className="mt-3 flex flex-col gap-2">
          {findings.map((finding, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the findings never reorder.
            <Finding key={index} finding={finding} />
          ))}
        </ul>
      )}
      {!clean && decision !== "manteve" && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          <Button type="button" size="sm" variant="outline" onClick={onChange}>
            Alterar antes de enviar
          </Button>
          <Button type="button" size="sm" onClick={onKeep}>
            Manter e enviar
          </Button>
          <span className="text-xs text-muted-foreground">
            A decisão é sua. Se mantiver, fica registrado na auditoria.
          </span>
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        A serventia aprende com cada nota enviada: os modelos de exigência, sem
        dados pessoais, vão para a Biblioteca de exigências.
      </p>
    </div>
  );
}

/** Under an attached document: how its review came out, folded. */
export function ReviewSummary({ review }: { review?: ReviewView }) {
  const [open, setOpen] = useState(false);
  if (!review) return null;
  const findings = review.result.findings;
  const clean = findings.length === 0;
  return (
    <div className="mt-1 ml-1 text-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={clean}
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 ${clean ? "text-success-text" : "cursor-pointer font-medium text-warning-text underline-offset-4 hover:underline"}`}
      >
        <AdminIcon
          name={clean ? "check" : "alert"}
          className="size-3.5 flex-none"
          strokeWidth={2}
        />
        Análise: {review.headline.toLowerCase()}
        {review.decision === "manteve" && !clean
          ? " · mantida pelo funcionário"
          : ""}
        {review.learnedCount > 0
          ? ` · ${review.learnedCount} modelo(s) aprendido(s)`
          : ""}
      </button>
      {open && !clean && (
        <ul className="mt-2 flex flex-col gap-2">
          {findings.map((finding, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the findings never reorder.
            <Finding key={index} finding={finding} />
          ))}
        </ul>
      )}
    </div>
  );
}
