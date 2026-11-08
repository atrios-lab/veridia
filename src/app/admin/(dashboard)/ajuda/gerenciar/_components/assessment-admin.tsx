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
import { ConfirmAction } from "../../../../_components/confirm-action.tsx";
import {
  deleteQuestionAction,
  type SaveTutorialState,
  saveAssessmentSettingsAction,
  saveQuestionAction,
  setQuestionActiveAction,
  type TutorialActionState,
} from "../actions.ts";

const FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";
const LABEL_CLASS = "mb-1.5 block text-xs font-bold text-admin-primary";
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
}

function Message({ state }: { state: SaveTutorialState }) {
  if (state.status !== "error") return null;
  return (
    <p
      role="alert"
      className="rounded-[9px] border border-admin-error-border bg-admin-error-bg px-3.5 py-2.5 text-[12.5px] font-semibold text-admin-error-text"
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={LABEL_CLASS} htmlFor={`${formId}-hours`}>
            Carga horária (horas)
          </label>
          <input
            id={`${formId}-hours`}
            name="workloadHours"
            type="number"
            min={1}
            max={200}
            defaultValue={settings.workloadHours ?? ""}
            placeholder="Sem certificado"
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor={`${formId}-score`}>
            Nota mínima (%)
          </label>
          <input
            id={`${formId}-score`}
            name="passingScore"
            type="number"
            min={1}
            max={100}
            defaultValue={settings.passingScore}
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor={`${formId}-retry`}>
            Intervalo entre tentativas (horas)
          </label>
          <input
            id={`${formId}-retry`}
            name="retryHours"
            type="number"
            min={0}
            max={168}
            defaultValue={settings.retryHours}
            className={FIELD_CLASS}
          />
        </div>
      </div>
      <p className="text-[11.5px] text-admin-faint">
        Sem carga horária, o curso não tem avaliação nem certificado. Com carga
        horária e ao menos uma questão ativa, a avaliação abre para quem
        assistiu a todos os vídeos.
      </p>
      <Message state={state} />
      <div>
        <button
          type="submit"
          disabled={pending}
          className="btn btn-admin-secondary btn-sm"
        >
          {pending ? "Salvando…" : "Salvar configuração"}
        </button>
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
      className="flex flex-col gap-3 rounded-[12px] border border-admin-border bg-admin-card p-4"
    >
      {editing && <input type="hidden" name="id" value={editing.id} />}
      <div>
        <label className={LABEL_CLASS} htmlFor={`${formId}-prompt`}>
          Enunciado
        </label>
        <textarea
          id={`${formId}-prompt`}
          name="prompt"
          rows={2}
          maxLength={500}
          defaultValue={editing?.prompt ?? ""}
          required
          className={FIELD_CLASS}
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
            />
            <span className="w-4 text-[12px] font-bold text-admin-faint">
              {letter}
            </span>
            <input
              name={`option${i}`}
              maxLength={240}
              defaultValue={editing?.options[i] ?? ""}
              required
              aria-label={`Alternativa ${letter}`}
              className={FIELD_CLASS}
            />
          </div>
        ))}
      </fieldset>
      {editing?.used && (
        <p className="text-[11.5px] text-admin-warning-text">
          Esta questão já apareceu em tentativas. Mudar a alternativa certa muda
          a correção das tentativas ainda não enviadas.
        </p>
      )}
      <Message state={state} />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-admin-primary btn-sm"
        >
          {pending
            ? "Salvando…"
            : editing
              ? "Salvar questão"
              : "Adicionar questão"}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={pending}
          className="btn btn-admin-ghost btn-sm"
        >
          Cancelar
        </button>
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
      triggerClassName="btn btn-admin-danger btn-sm"
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
    <div className="rounded-[12px] border border-admin-border bg-admin-card">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-[13.5px] font-semibold text-admin-primary">
          Avaliação e certificado
        </span>
        <span className="text-[12px] text-admin-muted">
          {settings.workloadHours
            ? `${settings.workloadHours} h · nota ${settings.passingScore}% · ${active} ${active === 1 ? "questão ativa" : "questões ativas"}`
            : "sem certificado"}
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-5 border-t border-admin-border px-4 py-4">
          <SettingsForm courseId={courseId} settings={settings} />
          <div className="flex flex-col gap-2.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-admin-faint">
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
                    className="flex flex-wrap items-start gap-3 rounded-[10px] border border-admin-border px-3.5 py-3"
                  >
                    <span className="w-6 flex-none text-[12px] font-bold text-admin-faint">
                      {index + 1}.
                    </span>
                    <div className="min-w-[220px] flex-1">
                      <p
                        className={`text-[13.5px] font-semibold ${question.active ? "text-admin-primary" : "text-admin-faint line-through"}`}
                      >
                        {question.prompt}
                      </p>
                      <p className="mt-0.5 text-[12px] text-admin-muted">
                        Certa: {LETTERS[question.correctIndex]}){" "}
                        {question.options[question.correctIndex]}
                        {!question.active && " · desativada"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditing(question.id)}
                        className="btn btn-admin-secondary btn-sm"
                      >
                        Editar
                      </button>
                      <button
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
                        className="btn btn-admin-ghost btn-sm"
                      >
                        {question.active ? "Desativar" : "Ativar"}
                      </button>
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
                <button
                  type="button"
                  onClick={() => setEditing("new")}
                  className="btn btn-admin-ghost btn-sm"
                >
                  + Nova questão
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
