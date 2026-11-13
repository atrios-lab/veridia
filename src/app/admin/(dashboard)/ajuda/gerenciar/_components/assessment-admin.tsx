"use client";

import {
  useActionState,
  useEffect,
  useId,
  useMemo,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { LONG_TEXT_MAX } from "@/core/text-limits.ts";
import { ConfirmAction } from "../../../../_components/confirm-action.tsx";
import { Button } from "../../../../_ui/button.tsx";
import { cn } from "../../../../_ui/cn.ts";
import { Input } from "../../../../_ui/input.tsx";
import { Label } from "../../../../_ui/label.tsx";
import { Textarea } from "../../../../_ui/textarea.tsx";
import {
  deleteQuestionAction,
  type SaveTutorialState,
  saveAssessmentSettingsAction,
  saveQuestionAction,
  setQuestionActiveAction,
  type TutorialActionState,
} from "../actions.ts";

const LABEL_CLASS = "mb-1.5 block text-sm font-medium text-foreground";
const LETTERS = ["A", "B", "C", "D"];

/** A question as the management screen sees it: the right answer
 * included, since this is where it is written. */
export interface AdminQuestionItem {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  active: boolean;
  used: boolean;
}

export interface AssessmentSettingsItem {
  passingScore: number;
  workloadHours: number | null;
  retryHours: number;
  certificateKind: "completion" | "participation";
}

function Message({ state }: { state: SaveTutorialState }) {
  if (state.status !== "error") return null;
  return (
    <p
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive"
    >
      {state.message}
    </p>
  );
}

function SettingsForm({
  courseId,
  settings,
}: {
  courseId: string;
  settings: AssessmentSettingsItem;
}) {
  const action = useMemo(
    () => saveAssessmentSettingsAction.bind(null, courseId),
    [courseId],
  );
  const [state, formAction, pending] = useActionState<
    SaveTutorialState,
    FormData
  >(action, { status: "idle" });
  const formId = useId();
  useEffect(() => {
    if (state.status === "saved") toast.success("Configuração salva.");
  }, [state]);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium text-foreground">
          Tipo de certificado
        </legend>
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="radio"
            name="certificateKind"
            value="completion"
            defaultChecked={settings.certificateKind === "completion"}
            className="mt-1"
          />
          <span>
            Conclusão, com avaliação
            <span className="block text-xs text-muted-foreground">
              Sai depois da aprovação, com o aproveitamento.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="radio"
            name="certificateKind"
            value="participation"
            defaultChecked={settings.certificateKind === "participation"}
            className="mt-1"
          />
          <span>
            Participação, sem avaliação
            <span className="block text-xs text-muted-foreground">
              Sai para quem assistiu a todos os vídeos. As questões, se houver,
              não aparecem.
            </span>
          </span>
        </label>
      </fieldset>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Label className="mb-1.5" htmlFor={`${formId}-hours`}>
            Carga horária (horas)
          </Label>
          <Input
            id={`${formId}-hours`}
            name="workloadHours"
            type="number"
            min={1}
            max={200}
            defaultValue={settings.workloadHours ?? ""}
            placeholder="Sem certificado"
          />
        </div>
        <div>
          <Label className="mb-1.5" htmlFor={`${formId}-score`}>
            Nota mínima (%)
          </Label>
          <Input
            id={`${formId}-score`}
            name="passingScore"
            type="number"
            min={1}
            max={100}
            defaultValue={settings.passingScore}
          />
        </div>
        <div>
          <Label className="mb-1.5" htmlFor={`${formId}-retry`}>
            Intervalo entre tentativas (horas)
          </Label>
          <Input
            id={`${formId}-retry`}
            name="retryHours"
            type="number"
            min={0}
            max={168}
            defaultValue={settings.retryHours}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Sem carga horária, o curso não tem avaliação nem certificado. Com carga
        horária, o certificado de conclusão exige ao menos uma questão ativa e a
        aprovação; o de participação sai depois de todos os vídeos. A nota e o
        intervalo só valem para o de conclusão.
      </p>
      <Message state={state} />
      <div>
        <Button type="submit" disabled={pending} variant="outline" size="sm">
          {pending ? "Salvando…" : "Salvar configuração"}
        </Button>
      </div>
    </form>
  );
}

function QuestionForm({
  courseId,
  editing,
  onDone,
}: {
  courseId: string;
  editing?: AdminQuestionItem;
  onDone: () => void;
}) {
  const action = useMemo(
    () => saveQuestionAction.bind(null, courseId),
    [courseId],
  );
  const [state, formAction, pending] = useActionState<
    SaveTutorialState,
    FormData
  >(action, { status: "idle" });
  const formId = useId();
  useEffect(() => {
    if (state.status === "saved") onDone();
  }, [state, onDone]);
  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border bg-muted/50 p-4"
    >
      {editing && <input type="hidden" name="id" value={editing.id} />}
      <div>
        <Label className="mb-1.5" htmlFor={`${formId}-prompt`}>
          Enunciado
        </Label>
        <Textarea
          id={`${formId}-prompt`}
          name="prompt"
          rows={2}
          maxLength={LONG_TEXT_MAX}
          defaultValue={editing?.prompt ?? ""}
          required
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className={LABEL_CLASS}>Alternativas (marque a certa)</legend>
        {LETTERS.map((letter, i) => (
          <div key={letter} className="flex items-center gap-2.5">
            <input
              type="radio"
              name="correctIndex"
              value={i}
              defaultChecked={editing?.correctIndex === i}
              aria-label={`Alternativa ${letter} é a certa`}
              required
              className="accent-primary"
            />
            <span className="w-4 text-xs font-semibold text-muted-foreground">
              {letter}
            </span>
            <Input
              name={`option${i}`}
              maxLength={240}
              defaultValue={editing?.options[i] ?? ""}
              required
              aria-label={`Alternativa ${letter}`}
            />
          </div>
        ))}
      </fieldset>
      {editing?.used && (
        <p className="text-xs text-warning-text">
          Esta questão já apareceu em tentativas. Mudar a alternativa certa muda
          a correção das tentativas ainda não enviadas.
        </p>
      )}
      <Message state={state} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} size="sm">
          {pending
            ? "Salvando…"
            : editing
              ? "Salvar questão"
              : "Adicionar questão"}
        </Button>
        <Button
          type="button"
          onClick={onDone}
          disabled={pending}
          variant="outline"
          size="sm"
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function DeleteQuestion({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState<
    TutorialActionState,
    FormData
  >(deleteQuestionAction, { status: "idle" });
  return (
    <ConfirmAction
      action={formAction}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Excluir"
      question="Excluir esta questão?"
      consequence="Ela some da avaliação. Uma questão que já apareceu em alguma tentativa não pode ser excluída, só desativada."
      confirmLabel="Excluir a questão"
      pendingLabel="Excluindo…"
      className="flex-none"
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmAction>
  );
}

/**
 * A course's "Avaliação" section in the management screen: the settings
 * (hours, minimum score, wait) and the questions, each with its right
 * answer marked. Closed by default, so the course list stays short.
 */
export function AssessmentAdmin({
  courseId,
  settings,
  questions,
}: {
  courseId: string;
  settings: AssessmentSettingsItem;
  questions: AdminQuestionItem[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [pending, startTransition] = useTransition();
  const active = questions.filter((q) => q.active).length;

  return (
    <div className="rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-foreground">
          Avaliação e certificado
        </span>
        <span className="text-xs text-muted-foreground">
          {!settings.workloadHours
            ? "sem certificado"
            : settings.certificateKind === "participation"
              ? `${settings.workloadHours} h · certificado de participação`
              : `${settings.workloadHours} h · nota ${settings.passingScore}% · ${active} ${active === 1 ? "questão ativa" : "questões ativas"}`}
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-5 border-t px-4 py-4">
          <SettingsForm courseId={courseId} settings={settings} />
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-medium text-muted-foreground">
              Questões
            </span>
            <ol className="flex flex-col gap-2">
              {questions.map((question, index) =>
                editing === question.id ? (
                  <li key={question.id}>
                    <QuestionForm
                      courseId={courseId}
                      editing={question}
                      onDone={() => setEditing(null)}
                    />
                  </li>
                ) : (
                  <li
                    key={question.id}
                    className="flex flex-wrap items-start gap-3 rounded-lg border px-3.5 py-3"
                  >
                    <span className="w-6 flex-none text-xs font-semibold text-muted-foreground tabular-nums">
                      {index + 1}.
                    </span>
                    <div className="min-w-[220px] flex-1">
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          question.active
                            ? "text-foreground"
                            : "text-muted-foreground line-through",
                        )}
                      >
                        {question.prompt}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Certa: {LETTERS[question.correctIndex]}){" "}
                        {question.options[question.correctIndex]}
                        {!question.active && " · desativada"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        onClick={() => setEditing(question.id)}
                        variant="outline"
                        size="sm"
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await setQuestionActiveAction(
                              question.id,
                              !question.active,
                            );
                            if (result.status === "error") {
                              toast.error(result.message);
                            }
                          })
                        }
                        variant="ghost"
                        size="sm"
                      >
                        {question.active ? "Desativar" : "Ativar"}
                      </Button>
                      {!question.used && <DeleteQuestion id={question.id} />}
                    </div>
                  </li>
                ),
              )}
            </ol>
            {editing === "new" ? (
              <QuestionForm
                courseId={courseId}
                onDone={() => setEditing(null)}
              />
            ) : (
              <div>
                <Button
                  type="button"
                  onClick={() => setEditing("new")}
                  variant="ghost"
                  size="sm"
                >
                  + Nova questão
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
