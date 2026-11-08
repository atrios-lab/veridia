"use client";

import { useRouter } from "next/navigation";
import { useActionState, useId, useMemo, useState, useTransition } from "react";
import {
  type CertificateFacts,
  certificateSentence,
  formatCertificateDate,
} from "@/core/courses/certificate.ts";
import type { ShownQuestion } from "@/core/courses/quiz.ts";
import { formatWait } from "@/core/courses/quiz.ts";
import { formatCpf, isValidCpf } from "@/core/request/form.ts";
import {
  type AttemptActionState,
  type IssueActionState,
  issueCertificateAction,
  startAttemptAction,
  submitAttemptAction,
} from "../actions.ts";

/** What the page hands down: the lib's state, serialisable. */
export type PanelState =
  | { kind: "locked"; videosLeft: number }
  | {
      kind: "available";
      last: { correct: number; total: number } | null;
      questionCount: number;
    }
  | { kind: "open"; attemptId: string; questions: ShownQuestion[] }
  | {
      kind: "wait";
      remainingMs: number;
      last: { correct: number; total: number };
    }
  | { kind: "passed"; score: number }
  | { kind: "certified"; code: string; issuedAt: string };

const FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";
const ERROR_FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-error-border bg-admin-error-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-error-text";
const LABEL_CLASS = "mb-1.5 block text-xs font-bold text-admin-primary";

function Alert({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-[9px] border border-admin-error-border bg-admin-error-bg px-3.5 py-2.5 text-[12.5px] font-semibold text-admin-error-text"
    >
      {message}
    </p>
  );
}

/**
 * The course page's "Avaliação" block. Every state comes from the server
 * (src/lib/quiz.ts); this only draws it and calls the actions, which check
 * every rule again. The right answers never reach this component: an open
 * attempt arrives as prompts and alternatives, in the drawn order.
 */
export function AssessmentPanel({
  courseId,
  courseSlug,
  courseTitle,
  passingScore,
  retryHours,
  workloadHours,
  tenantName,
  accountName,
  checkUrl,
  state,
}: {
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  passingScore: number;
  retryHours: number;
  workloadHours: number;
  tenantName: string;
  accountName: string;
  /** The Átrios site's check address for a code, minus the code. */
  checkUrl: string;
  state: PanelState;
}) {
  return (
    <section
      aria-labelledby="assessment-title"
      className="rounded-[16px] border border-admin-border bg-admin-card p-6"
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-admin-faint">
        Avaliação e certificado
      </span>
      <h2
        id="assessment-title"
        className="mt-1 font-serif text-[20px] leading-tight font-semibold text-admin-primary"
      >
        {state.kind === "certified"
          ? "Curso concluído"
          : state.kind === "passed"
            ? "Você foi aprovado"
            : "Avaliação do curso"}
      </h2>
      <div className="mt-3">
        {state.kind === "locked" && (
          <p className="text-[13.5px] text-admin-muted">
            Abre depois que você assistir a todos os vídeos do curso. Falta
            {state.videosLeft === 1
              ? " 1 vídeo"
              : `m ${state.videosLeft} vídeos`}
            .
          </p>
        )}
        {state.kind === "available" && (
          <Available
            courseId={courseId}
            questionCount={state.questionCount}
            passingScore={passingScore}
            retryHours={retryHours}
            last={state.last}
          />
        )}
        {state.kind === "open" && (
          <Attempt attemptId={state.attemptId} questions={state.questions} />
        )}
        {state.kind === "wait" && (
          <p className="text-[13.5px] text-admin-muted">
            Na última tentativa você acertou {state.last.correct} de{" "}
            {state.last.total}, abaixo da nota mínima de {passingScore}%. Uma
            nova tentativa fica disponível em{" "}
            <strong className="text-admin-primary">
              {formatWait(state.remainingMs)}
            </strong>
            .
          </p>
        )}
        {state.kind === "passed" && (
          <IssueForm
            courseId={courseId}
            score={state.score}
            facts={{
              courseTitle,
              workloadHours,
              tenantName,
              score: state.score,
            }}
            accountName={accountName}
          />
        )}
        {state.kind === "certified" && (
          <div className="flex flex-col gap-3">
            <p className="text-[13.5px] text-admin-muted">
              Seu certificado foi emitido em{" "}
              {formatCertificateDate(new Date(state.issuedAt))}, com o código de
              validação{" "}
              <strong className="font-mono text-admin-primary">
                {state.code}
              </strong>
              . O PDF é assinado digitalmente; qualquer pessoa confere a
              validade pelo código.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={`/admin/ajuda/${encodeURIComponent(courseSlug)}/certificado`}
                className="btn btn-admin-primary btn-sm"
              >
                Baixar certificado (PDF)
              </a>
              <a
                href={`${checkUrl.replace(/\/+$/, "")}/${state.code}`}
                target="_blank"
                rel="noopener"
                className="btn btn-admin-secondary btn-sm"
              >
                Página de validação
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Available({
  courseId,
  questionCount,
  passingScore,
  retryHours,
  last,
}: {
  courseId: string;
  questionCount: number;
  passingScore: number;
  retryHours: number;
  last: { correct: number; total: number } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13.5px] leading-normal text-admin-muted">
        São {questionCount} questões de múltipla escolha, em ordem sorteada.
        Para ser aprovado, acerte pelo menos {passingScore}%. Se não atingir a
        nota, uma nova tentativa abre {retryHours} horas depois. O resultado
        mostra quantas você acertou, sem indicar as respostas.
      </p>
      {last && (
        <p className="text-[12.5px] text-admin-faint">
          Última tentativa: {last.correct} de {last.total}.
        </p>
      )}
      {error && <Alert message={error} />}
      <div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await startAttemptAction(courseId);
              if (result.status === "error") setError(result.message);
              else router.refresh();
            })
          }
          className="btn btn-admin-primary btn-sm"
        >
          {pending ? "Preparando…" : "Iniciar avaliação"}
        </button>
      </div>
    </div>
  );
}

function Attempt({
  attemptId,
  questions,
}: {
  attemptId: string;
  questions: ShownQuestion[];
}) {
  const router = useRouter();
  const [picks, setPicks] = useState<(number | null)[]>(() =>
    questions.map(() => null),
  );
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AttemptActionState>();
  const answered = picks.filter((p) => p !== null).length;
  const formId = useId();

  if (result?.status === "graded") {
    return (
      <div className="flex flex-col gap-3" aria-live="polite">
        <p
          className={
            result.passed
              ? "rounded-[10px] bg-admin-success-bg px-4 py-3 text-[14px] font-semibold text-admin-success-text"
              : "rounded-[10px] bg-admin-warning-soft-bg px-4 py-3 text-[14px] font-semibold text-admin-warning-text"
          }
        >
          Você acertou {result.correct} de {result.total}.{" "}
          {result.passed
            ? "Aprovado! Agora é só emitir o seu certificado."
            : "Não foi desta vez: a nota ficou abaixo da mínima."}
        </p>
        <div>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="btn btn-admin-primary btn-sm"
          >
            {result.passed ? "Emitir o certificado" : "Continuar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const outcome = await submitAttemptAction(attemptId, picks);
          setResult(outcome);
        });
      }}
    >
      <ol className="flex flex-col gap-5">
        {questions.map((question, q) => (
          <li key={question.id}>
            <fieldset>
              <legend className="text-[14px] leading-snug font-semibold text-admin-primary">
                {q + 1}. {question.prompt}
              </legend>
              <div className="mt-2 flex flex-col gap-1.5">
                {question.options.map((option, o) => {
                  const id = `${formId}-${q}-${o}`;
                  return (
                    <label
                      key={id}
                      htmlFor={id}
                      className={`flex cursor-pointer items-start gap-2.5 rounded-[9px] border px-3.5 py-2.5 text-[13.5px] text-admin-text ${
                        picks[q] === o
                          ? "border-admin-primary bg-admin-surface"
                          : "border-admin-border hover:bg-admin-surface"
                      }`}
                    >
                      <input
                        id={id}
                        type="radio"
                        name={`q${q}`}
                        checked={picks[q] === o}
                        disabled={pending}
                        onChange={() =>
                          setPicks((current) =>
                            current.map((p, i) => (i === q ? o : p)),
                          )
                        }
                        className="mt-0.5"
                      />
                      <span>{option}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>
      {result?.status === "error" && <Alert message={result.message} />}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || answered < questions.length}
          className="btn btn-admin-primary btn-md"
        >
          {pending ? "Enviando…" : "Enviar respostas"}
        </button>
        <span className="text-[12.5px] text-admin-faint">
          {answered} de {questions.length} respondidas
        </span>
      </div>
    </form>
  );
}

function IssueForm({
  courseId,
  score,
  facts,
  accountName,
}: {
  courseId: string;
  score: number;
  facts: Pick<
    CertificateFacts,
    "courseTitle" | "workloadHours" | "tenantName" | "score"
  >;
  accountName: string;
}) {
  const router = useRouter();
  const action = useMemo(
    () => issueCertificateAction.bind(null, courseId),
    [courseId],
  );
  const [state, formAction, pending] = useActionState<
    IssueActionState,
    FormData
  >(
    async (previous, data) => {
      const next = await action(previous, data);
      if (next.status === "issued") router.refresh();
      return next;
    },
    { status: "idle" },
  );
  const [fullName, setFullName] = useState(accountName);
  const [cpf, setCpf] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const formId = useId();
  const fieldErrors = state.status === "error" ? state.fieldErrors : {};
  const preview = certificateSentence(
    {
      ...facts,
      fullName: fullName.trim() || "Seu nome completo",
      cpf: isValidCpf(cpf) ? cpf : "00000000000",
      roleTitle: roleTitle.trim() || "sua função",
      issuedAt: new Date(),
    },
    "full",
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-[13.5px] text-admin-muted">
        Aproveitamento de {score}%. Para emitir o certificado, confira os seus
        dados. Eles são usados só para emitir e validar o certificado; o CPF
        aparece completo apenas no seu PDF. Depois de emitido, o certificado não
        pode ser alterado por aqui.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <label className={LABEL_CLASS} htmlFor={`${formId}-name`}>
            Nome completo
          </label>
          <input
            id={`${formId}-name`}
            name="fullName"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            maxLength={120}
            required
            autoComplete="name"
            className={fieldErrors.fullName ? ERROR_FIELD_CLASS : FIELD_CLASS}
          />
          {fieldErrors.fullName && (
            <p className="mt-1.5 text-xs font-semibold text-admin-error-text">
              {fieldErrors.fullName}
            </p>
          )}
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor={`${formId}-cpf`}>
            CPF
          </label>
          <input
            id={`${formId}-cpf`}
            name="cpf"
            value={cpf}
            onChange={(event) => setCpf(formatCpf(event.target.value))}
            inputMode="numeric"
            required
            placeholder="000.000.000-00"
            className={fieldErrors.cpf ? ERROR_FIELD_CLASS : FIELD_CLASS}
          />
          {fieldErrors.cpf && (
            <p className="mt-1.5 text-xs font-semibold text-admin-error-text">
              {fieldErrors.cpf}
            </p>
          )}
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor={`${formId}-role`}>
            Função
          </label>
          <input
            id={`${formId}-role`}
            name="roleTitle"
            value={roleTitle}
            onChange={(event) => setRoleTitle(event.target.value)}
            maxLength={60}
            required
            placeholder="Escrevente"
            className={fieldErrors.roleTitle ? ERROR_FIELD_CLASS : FIELD_CLASS}
          />
          {fieldErrors.roleTitle && (
            <p className="mt-1.5 text-xs font-semibold text-admin-error-text">
              {fieldErrors.roleTitle}
            </p>
          )}
        </div>
      </div>
      <div className="rounded-[10px] border border-admin-border bg-admin-surface px-4 py-3">
        <span className="block text-[10.5px] font-bold uppercase tracking-[0.08em] text-admin-faint">
          O seu certificado vai sair assim
        </span>
        <p className="mt-1.5 font-serif text-[15px] leading-relaxed text-admin-primary">
          {preview}
        </p>
      </div>
      {state.status === "error" && <Alert message={state.message} />}
      <div>
        <button
          type="submit"
          disabled={pending}
          className="btn btn-admin-primary btn-md"
        >
          {pending ? "Emitindo…" : "Emitir certificado"}
        </button>
      </div>
    </form>
  );
}
