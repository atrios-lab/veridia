"use client";

import { useActionState, useId } from "react";
import { FICHA, type FichaField } from "@/core/rcpn/ficha.ts";
import type { RcpnKind } from "@/core/rcpn/record.ts";
import { LONG_TEXT_MAX, MIN_JUSTIFICATION } from "@/core/text-limits.ts";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import { Label } from "../../../_ui/label.tsx";
import { Textarea } from "../../../_ui/textarea.tsx";
import {
  cancelRecordAction,
  type FichaState,
  restoreRecordAction,
  saveFichaAction,
} from "./actions.ts";

const IDLE: FichaState = { status: "idle" };

function Field({
  id,
  field,
  value,
}: {
  id: string;
  field: FichaField;
  value: string;
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
          rows={field.key === "d.observacoes" ? 6 : 3}
          maxLength={20000}
        />
      ) : field.locked ? (
        <Input
          id={id}
          value={value}
          readOnly
          aria-readonly="true"
          className="bg-muted font-mono text-muted-foreground"
        />
      ) : (
        <Input
          id={id}
          name={field.key}
          type={field.input === "date" ? "date" : "text"}
          defaultValue={value}
          maxLength={500}
          autoComplete="off"
          className={field.key === "r.matricula" ? "font-mono" : ""}
        />
      )}
      {field.hint && (
        <p className="text-xs text-muted-foreground">{field.hint}</p>
      )}
    </div>
  );
}

/**
 * The whole registro to correct, section by section, in the order of the
 * termo. Saving asks why: the reason, and each field before and after, go
 * to the ficha's history and to the audit.
 */
export function FichaForm({
  id,
  kind,
  values,
}: {
  id: string;
  kind: RcpnKind;
  values: Record<string, string>;
}) {
  const [state, action, pending] = useActionState<FichaState, FormData>(
    saveFichaAction,
    IDLE,
  );
  const base = useId();
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="tipo" value={kind} />
      {FICHA[kind].map((section) => (
        <section
          key={section.title}
          className="rounded-xl border bg-card p-6 shadow-xs"
        >
          <h2 className="text-lg font-semibold text-foreground">
            {section.title}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {section.fields.map((field) => (
              <Field
                key={field.key}
                id={`${base}-${field.key}`}
                field={field}
                value={values[field.key] ?? ""}
              />
            ))}
          </div>
        </section>
      ))}
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-6 shadow-xs">
        <Label htmlFor={`${base}-justificativa`}>Justificativa</Label>
        <Textarea
          id={`${base}-justificativa`}
          name="justificativa"
          required
          minLength={MIN_JUSTIFICATION}
          maxLength={LONG_TEXT_MAX}
          rows={3}
          placeholder="Por exemplo: conferido com o livro, folha e termo do registro; corrigido o nome da avó."
        />
        <p className="text-xs text-muted-foreground">
          A justificativa e cada campo, como era e como ficou, vão para o
          histórico da ficha e para a auditoria. O livro continua sendo o que dá
          fé: corrija aqui só o que estiver diferente do termo.
        </p>
        {state.status === "error" && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {state.message}
          </p>
        )}
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </section>
    </form>
  );
}

export function CancelRecordButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState<FichaState, FormData>(
    cancelRecordAction,
    IDLE,
  );
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Cancelar registro"
      question="Cancelar este registro?"
      consequence="Ele continua guardado, marcado como cancelado, com quem cancelou, quando e por quê. Pode ser estornado depois."
      confirmLabel="Cancelar registro"
      pendingLabel="Cancelando..."
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmAction>
  );
}

export function RestoreRecordButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState<FichaState, FormData>(
    restoreRecordAction,
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
      consequence="O registro volta a valer no índice. O cancelamento e o estorno ficam no histórico da ficha e na auditoria."
      confirmLabel="Estornar"
      pendingLabel="Estornando..."
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmAction>
  );
}
