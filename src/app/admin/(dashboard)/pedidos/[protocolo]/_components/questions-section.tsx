"use client";

import { useActionState, useRef } from "react";
import { toast } from "sonner";
import { deriveQuestionThreadStatus } from "@/core/request/question.ts";
import { type ActionState, replyQuestionAction } from "../actions.ts";

export interface QuestionItem {
  id: string;
  authorType: "citizen" | "staff";
  /** Who wrote it, when it is the office — null on every citizen message. */
  authorName: string | null;
  body: string;
  createdAt: Date;
}

function formatDayMonthTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function QuestionBadge({
  status,
}: {
  status: ReturnType<typeof deriveQuestionThreadStatus>;
}) {
  if (status === "none") return null;
  if (status === "answered") {
    return (
      <span className="rounded-full bg-admin-success-bg px-2.5 py-0.5 text-[10.5px] font-bold text-admin-success-text">
        Respondida
      </span>
    );
  }
  return (
    <span className="rounded-full bg-admin-warning-bg px-2.5 py-0.5 text-[10.5px] font-bold text-admin-warning-text">
      Aguardando resposta
    </span>
  );
}

function QuestionMessage({
  message,
  applicantName,
}: {
  message: QuestionItem;
  applicantName: string;
}) {
  const isCitizen = message.authorType === "citizen";
  return (
    <div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[13px] font-bold text-admin-primary">
          {isCitizen ? applicantName : (message.authorName ?? "Operador")}
        </span>
        <span className="text-[11px] text-admin-faint">
          {formatDayMonthTime(message.createdAt)}
        </span>
      </div>
      <div
        className={`mt-1 rounded-[9px] px-3 py-2.5 ${isCitizen ? "bg-admin-input-bg" : "bg-admin-success-bg"}`}
      >
        <p className="text-[13px] leading-relaxed text-admin-text">
          {message.body}
        </p>
      </div>
    </div>
  );
}

function QuestionComposer({ requestId }: { requestId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    // The toast fires here, not in an effect, same reasoning as the
    // attachment delete button: `toast` is a store outside React, so it
    // survives regardless of what the revalidated page does next.
    async (previous, formData) => {
      const result = await replyQuestionAction(previous, formData);
      if (result.status === "success") {
        toast.success("Resposta enviada. Já aparece na consulta do cidadão.");
        formRef.current?.reset();
      }
      return result;
    },
    { status: "idle" },
  );

  return (
    <form ref={formRef} action={action} className="mt-4">
      <input type="hidden" name="requestId" value={requestId} />
      <textarea
        name="body"
        rows={2}
        placeholder="Responder ao cidadão…"
        className="w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13px] text-admin-text placeholder:text-admin-faint"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        {state.status === "error" ? (
          <p
            role="alert"
            className="text-[12px] font-semibold text-admin-error-text"
          >
            {state.message}
          </p>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={pending}
          className="btn btn-admin-primary btn-sm shrink-0"
        >
          {pending ? "Enviando…" : "Enviar resposta"}
        </button>
      </div>
    </form>
  );
}

/**
 * The office side of the thread the citizen sees on their protocol consult.
 * No live update here either (US-07): the list is whatever the server just
 * sent, refreshed by `revalidateAdmin()` after a reply, same as every other
 * section on this page.
 */
export function QuestionsSection({
  requestId,
  applicantName,
  questions,
}: {
  requestId: string;
  applicantName: string;
  questions: QuestionItem[];
}) {
  const status = deriveQuestionThreadStatus(questions);

  return (
    <div className="rounded-[14px] border border-admin-border bg-admin-card p-6">
      <div className="flex items-center gap-2.5">
        <h4 className="flex-1 font-serif text-[17px] font-semibold text-admin-primary">
          Perguntas do cidadão
        </h4>
        <QuestionBadge status={status} />
      </div>
      <p className="mt-1 text-[12.5px] text-admin-muted">
        O que você responder aqui aparece na consulta do cidadão pelo protocolo,
        sem precisar de e-mail nem telefone.
      </p>

      {questions.length > 0 && (
        <div className="mt-4 flex flex-col gap-4">
          {questions.map((question) => (
            <QuestionMessage
              key={question.id}
              message={question}
              applicantName={applicantName}
            />
          ))}
        </div>
      )}

      <QuestionComposer requestId={requestId} />
    </div>
  );
}
