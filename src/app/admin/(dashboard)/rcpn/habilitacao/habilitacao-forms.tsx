"use client";

import { useActionState, useId, useState } from "react";
import {
  HABILITACAO_SECTIONS,
  type HabilitacaoField,
  type HabilitacaoKind,
} from "@/core/rcpn/habilitacao.ts";
import { LONG_TEXT_MAX, MIN_JUSTIFICATION } from "@/core/text-limits.ts";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import { Label } from "../../../_ui/label.tsx";
import { NativeSelect } from "../../../_ui/native-select.tsx";
import { Textarea } from "../../../_ui/textarea.tsx";
import {
  cancelHabilitacaoAction,
  certificadoTodayAction,
  createHabilitacaoAction,
  type HabilitacaoState,
  publishEditalAction,
  restoreHabilitacaoAction,
  saveHabilitacaoAction,
} from "./actions.ts";

const IDLE: HabilitacaoState = { status: "idle" };

function Field({
  id,
  field,
  value,
  onKind,
}: {
  id: string;
  field: HabilitacaoField;
  value: string;
  onKind?: (kind: HabilitacaoKind) => void;
}) {
  return (
    <div
      className={
        field.half || field.input === "date"
          ? "flex min-w-0 flex-col gap-1.5"
          : "flex min-w-0 flex-col gap-1.5 sm:col-span-2"
      }
    >
      <Label htmlFor={id}>{field.label}</Label>
      {field.input === "long" ? (
        <Textarea
          id={id}
          name={field.key}
          defaultValue={value}
          rows={3}
          maxLength={LONG_TEXT_MAX}
        />
      ) : field.input === "select" ? (
        <NativeSelect
          id={id}
          name={field.key}
          defaultValue={value}
          className="w-full"
          onChange={
            onKind
              ? (event) => onKind(event.target.value as HabilitacaoKind)
              : undefined
          }
        >
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      ) : (
        <Input
          id={id}
          name={field.key}
          type={field.input === "date" ? "date" : "text"}
          defaultValue={value}
          maxLength={500}
          autoComplete="off"
        />
      )}
      {field.hint && (
        <p className="text-xs text-muted-foreground text-justify hyphens-auto">
          {field.hint}
        </p>
      )}
    </div>
  );
}

/**
 * The whole processo, typed once (decision of 14/11/2026). Opening it
 * needs no reason; correcting it asks why, and the history keeps each
 * field before and after.
 */
export function HabilitacaoForm({
  id,
  values,
}: {
  /** Absent: a new processo. */
  id?: string;
  values: Record<string, string>;
}) {
  const [state, action, pending] = useActionState<HabilitacaoState, FormData>(
    id ? saveHabilitacaoAction : createHabilitacaoAction,
    IDLE,
  );
  const [kind, setKind] = useState<HabilitacaoKind>(
    (values.tipo as HabilitacaoKind) || "civil",
  );
  const base = useId();
  return (
    <form action={action} className="flex flex-col gap-5">
      {id && <input type="hidden" name="id" value={id} />}
      {HABILITACAO_SECTIONS.map((section) => {
        const fields = section.fields.filter(
          (f) => !f.only || f.only.includes(kind),
        );
        if (fields.length === 0) return null;
        return (
          <section
            key={section.title}
            className="rounded-xl border bg-card p-6 shadow-xs"
          >
            <h2 className="text-lg font-semibold text-foreground">
              {section.title}
            </h2>
            {section.hint && (
              <p className="mt-1 text-sm text-muted-foreground text-justify hyphens-auto">
                {section.hint}
              </p>
            )}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {fields.map((field) => (
                <Field
                  key={field.key}
                  id={`${base}-${field.key}`}
                  field={field}
                  value={values[field.key] ?? ""}
                  onKind={field.key === "tipo" ? setKind : undefined}
                />
              ))}
            </div>
          </section>
        );
      })}
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-6 shadow-xs">
        {id && (
          <>
            <Label htmlFor={`${base}-justificativa`}>Justificativa</Label>
            <Textarea
              id={`${base}-justificativa`}
              name="justificativa"
              required
              minLength={MIN_JUSTIFICATION}
              maxLength={LONG_TEXT_MAX}
              rows={3}
              placeholder="Por exemplo: os nubentes trouxeram o pacto antenupcial; corrigido o nome da mãe."
            />
            <p className="text-xs text-muted-foreground">
              A justificativa e cada campo, como era e como ficou, vão para o
              histórico do processo e para a auditoria.
            </p>
          </>
        )}
        {!id && (
          <p className="text-sm text-muted-foreground text-justify hyphens-auto">
            Pode salvar com o que tiver agora e completar depois, em Alterar. O
            processo mostra o que ainda falta antes do edital e do certificado.
          </p>
        )}
        {state.status === "error" && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {state.message}
          </p>
        )}
        <div>
          <Button type="submit" disabled={pending}>
            {pending
              ? "Salvando..."
              : id
                ? "Salvar alterações"
                : "Abrir processo"}
          </Button>
        </div>
      </section>
    </form>
  );
}

function ErrorLine({ state }: { state: HabilitacaoState }) {
  return state.status === "error" ? (
    <p role="alert" className="text-sm font-medium text-destructive">
      {state.message}
    </p>
  ) : null;
}

export function PublishEditalButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState<HabilitacaoState, FormData>(
    publishEditalAction,
    IDLE,
  );
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Publicando..." : "Publicar o edital no site"}
        </Button>
      </div>
      <ErrorLine state={state} />
    </form>
  );
}

export function CertificadoTodayButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState<HabilitacaoState, FormData>(
    certificadoTodayAction,
    IDLE,
  );
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Extraindo..." : "Extrair certificado hoje"}
        </Button>
      </div>
      <ErrorLine state={state} />
    </form>
  );
}

export function CancelHabilitacaoButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState<HabilitacaoState, FormData>(
    cancelHabilitacaoAction,
    IDLE,
  );
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Cancelar processo"
      question="Cancelar este processo de habilitação?"
      consequence="Ele continua guardado, marcado como cancelado, com quem cancelou, quando e por quê. Pode ser estornado depois."
      confirmLabel="Cancelar processo"
      pendingLabel="Cancelando..."
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmAction>
  );
}

export function RestoreHabilitacaoButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState<HabilitacaoState, FormData>(
    restoreHabilitacaoAction,
    IDLE,
  );
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Estornar cancelamento"
      triggerClassName={buttonVariants({ variant: "outline", size: "sm" })}
      question="Estornar o cancelamento?"
      consequence="O processo volta a andar. O cancelamento e o estorno ficam no histórico e na auditoria."
      confirmLabel="Estornar"
      pendingLabel="Estornando..."
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmAction>
  );
}
