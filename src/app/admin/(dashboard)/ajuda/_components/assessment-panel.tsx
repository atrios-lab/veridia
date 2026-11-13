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
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import { cn } from "../../../_ui/cn.ts";
import { Input } from "../../../_ui/input.tsx";
import { Label } from "../../../_ui/label.tsx";
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
  | { kind: "ready" }
  | { kind: "certified"; code: string; issuedAt: string };

function Alert({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive"
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
  participation,
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
  /** A participation certificate: no assessment, issued after the videos. */
  participation: boolean;
  state: PanelState;
}) {
  return (
    <section
      aria-labelledby="assessment-title"
      className="rounded-xl border bg-card p-6"
    >
      <span className="text-xs font-medium text-muted-foreground">
        {participation ? "Certificado" : "Avaliação e certificado"}
      </span>
      <h2
        id="assessment-title"
        className="mt-1 text-xl leading-tight font-semibold text-foreground"
      >
        {state.kind === "certified"
          ? "Curso concluído"
          : state.kind === "passed"
            ? "Você foi aprovado"
            : state.kind === "ready"
              ? "Você assistiu a todo o curso"
              : participation
                ? "Certificado de participação"
                : "Avaliação do curso"}
      </h2>
      <div className="mt-3">
        {state.kind === "locked" && (
          <p className="text-sm text-muted-foreground">
            {participation
              ? "O certificado de participação sai depois que você assistir a todos os vídeos do curso. Falta"
              : "Abre depois que você assistir a todos os vídeos do curso. Falta"}
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
          <p className="text-sm text-muted-foreground">
            Na última tentativa você acertou {state.last.correct} de{" "}
            {state.last.total}, abaixo da nota mínima de {passingScore}%. Uma
            nova tentativa fica disponível em{" "}
            <strong className="text-foreground">
              {formatWait(state.remainingMs)}
            </strong>
            .
          </p>
        )}
        {state.kind === "ready" && (
          <IssueForm
            courseId={courseId}
            score={null}
            facts={{ courseTitle, workloadHours, tenantName, score: null }}
            accountName={accountName}
          />
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
            <p className="text-sm text-muted-foreground">
              Seu certificado foi emitido em{" "}
              {formatCertificateDate(new Date(state.issuedAt))}, com o código de
              validação{" "}
              <strong className="font-mono text-foreground">
                {state.code}
              </strong>
              . O PDF é assinado digitalmente; qualquer pessoa confere a
              validade pelo código.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={`/admin/ajuda/${encodeURIComponent(courseSlug)}/certificado`}
                className={buttonVariants({ size: "sm" })}
              >
                Baixar certificado (PDF)
              </a>
              <a
                href={`${checkUrl.replace(/\/+$/, "")}/${state.code}`}
                target="_blank"
                rel="noopener"
                className={buttonVariants({ variant: "outline", size: "sm" })}
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
      <p className="text-sm leading-normal text-muted-foreground">
        São {questionCount} questões de múltipla escolha, em ordem sorteada.
        Para ser aprovado, acerte pelo menos {passingScore}%. Se não atingir a
        nota, uma nova tentativa abre {retryHours} horas depois. O resultado
        mostra quantas você acertou, sem indicar as respostas.
      </p>
      {last && (
        <p className="text-xs text-muted-foreground">
          Última tentativa: {last.correct} de {last.total}.
        </p>
      )}
      {error && <Alert message={error} />}
      <div>
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await startAttemptAction(courseId);
              if (result.status === "error") setError(result.message);
              else router.refresh();
            })
          }
        >
          {pending ? "Preparando…" : "Iniciar avaliação"}
        </Button>
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
              ? "rounded-lg bg-success-soft px-4 py-3 text-sm font-semibold text-success-text"
              : "rounded-lg bg-warning-soft px-4 py-3 text-sm font-semibold text-warning-text"
          }
        >
          Você acertou {result.correct} de {result.total}.{" "}
          {result.passed
            ? "Aprovado! Agora é só emitir o seu certificado."
            : "Não foi desta vez: a nota ficou abaixo da mínima."}
        </p>
        <div>
          <Button type="button" size="sm" onClick={() => router.refresh()}>
            {result.passed ? "Emitir o certificado" : "Continuar"}
          </Button>
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
              <legend className="text-sm leading-snug font-semibold text-foreground">
                {q + 1}. {question.prompt}
              </legend>
              <div className="mt-2 flex flex-col gap-1.5">
                {question.options.map((option, o) => {
                  const id = `${formId}-${q}-${o}`;
                  return (
                    <label
                      key={id}
                      htmlFor={id}
                      className={cn(
                        "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm text-foreground",
                        picks[q] === o
                          ? "border-primary bg-muted"
                          : "border-border hover:bg-muted",
                      )}
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
                        className="mt-0.5 accent-primary"
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
        <Button type="submit" disabled={pending || answered < questions.length}>
          {pending ? "Enviando…" : "Enviar respostas"}
        </Button>
        <span className="text-xs text-muted-foreground">
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
  /** Null on a participation certificate. */
  score: number | null;
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
      <p className="text-sm text-muted-foreground">
        {score === null
          ? "Para emitir o seu certificado de participação, confira os seus dados."
          : `Aproveitamento de ${score}%. Para emitir o certificado, confira os seus dados.`}{" "}
        Eles são usados só para emitir e validar o certificado; o CPF aparece
        completo apenas no seu PDF. Depois de emitido, o certificado não pode
        ser alterado por aqui.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <Label className="mb-1.5" htmlFor={`${formId}-name`}>
            Nome completo
          </Label>
          <Input
            id={`${formId}-name`}
            name="fullName"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            maxLength={120}
            required
            autoComplete="name"
            aria-invalid={fieldErrors.fullName ? true : undefined}
          />
          {fieldErrors.fullName && (
            <p className="mt-1.5 text-xs font-medium text-destructive">
              {fieldErrors.fullName}
            </p>
          )}
        </div>
        <div>
          <Label className="mb-1.5" htmlFor={`${formId}-cpf`}>
            CPF
          </Label>
          <Input
            id={`${formId}-cpf`}
            name="cpf"
            value={cpf}
            onChange={(event) => setCpf(formatCpf(event.target.value))}
            inputMode="numeric"
            required
            placeholder="000.000.000-00"
            aria-invalid={fieldErrors.cpf ? true : undefined}
          />
          {fieldErrors.cpf && (
            <p className="mt-1.5 text-xs font-medium text-destructive">
              {fieldErrors.cpf}
            </p>
          )}
        </div>
        <div>
          <Label className="mb-1.5" htmlFor={`${formId}-role`}>
            Função
          </Label>
          <Input
            id={`${formId}-role`}
            name="roleTitle"
            value={roleTitle}
            onChange={(event) => setRoleTitle(event.target.value)}
            maxLength={60}
            required
            placeholder="Escrevente"
            aria-invalid={fieldErrors.roleTitle ? true : undefined}
          />
          {fieldErrors.roleTitle && (
            <p className="mt-1.5 text-xs font-medium text-destructive">
              {fieldErrors.roleTitle}
            </p>
          )}
        </div>
      </div>
      <div className="rounded-lg border bg-muted/50 px-4 py-3">
        <span className="block text-xs font-medium text-muted-foreground">
          O seu certificado vai sair assim
        </span>
        <p className="mt-1.5 text-base leading-relaxed text-foreground">
          {preview}
        </p>
      </div>
      {state.status === "error" && <Alert message={state.message} />}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Emitindo…" : "Emitir certificado"}
        </Button>
      </div>
    </form>
  );
}
