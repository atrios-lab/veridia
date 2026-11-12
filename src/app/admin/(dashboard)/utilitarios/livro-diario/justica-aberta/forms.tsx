"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "../../../../_components/confirm-action.tsx";
import { Button } from "../../../../_ui/button.tsx";
import { Input } from "../../../../_ui/input.tsx";
import { Label } from "../../../../_ui/label.tsx";
import { Textarea } from "../../../../_ui/textarea.tsx";
import {
  declareNoFcrcpn,
  type JusticaAbertaFormState,
  removeFcrcpn,
  saveFcrcpn,
} from "./actions.ts";

const IDLE: JusticaAbertaFormState = { status: "idle" };

function Feedback({ state }: { state: JusticaAbertaFormState }) {
  useEffect(() => {
    if (state.status === "saved") toast.success(state.message);
  }, [state]);
  if (state.status !== "error") return null;
  return (
    <p
      role="alert"
      className="rounded-lg bg-destructive-soft px-3.5 py-2.5 text-sm font-semibold text-destructive"
    >
      {state.message}
    </p>
  );
}

/**
 * One field of the form, as the form names it, with its value and a button
 * that copies the value the way the form takes it: digits and comma, no
 * "R$".
 */
export function CopyField({
  label,
  value,
  copy,
  strong,
}: {
  label: string;
  /** What the screen shows ("R$ 16.936,79"). */
  value: string;
  /** What goes to the clipboard ("16.936,79"). */
  copy: string;
  strong?: boolean;
}) {
  const [copied, setCopied] = useState<boolean | null>(null);
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(copy);
      setCopied(true);
    } catch {
      setCopied(false);
    }
    setTimeout(() => setCopied(null), 2000);
  }
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2 last:border-b-0">
      <span
        className={`text-sm ${strong ? "font-semibold text-foreground" : "text-muted-foreground"}`}
      >
        {label}
      </span>
      <span className="flex items-center gap-2">
        <span
          className={`tabular-nums ${strong ? "text-base font-semibold" : "text-sm"} text-foreground`}
        >
          {value}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCopy}
          aria-label={`Copiar ${label}`}
        >
          {copied === true
            ? "Copiado"
            : copied === false
              ? "Não copiou"
              : "Copiar"}
        </Button>
      </span>
    </div>
  );
}

export interface FcrcpnInitial {
  id?: string;
  receivedOn: string;
  competence: string;
  payer: string;
  received: string;
  withheld: string;
  notes: string;
}

/** A repasse of the FCRCPN, new or corrected. */
export function FcrcpnForm({
  initial,
  onDone,
}: {
  initial: FcrcpnInitial;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(saveFcrcpn, IDLE);
  useEffect(() => {
    if (state.status === "saved") onDone?.();
  }, [state, onDone]);
  const key = initial.id ?? "novo";
  return (
    <form action={action} className="flex flex-col gap-3">
      <Feedback state={state} />
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`fc-on-${key}`}>Recebido em</Label>
          <Input
            id={`fc-on-${key}`}
            name="recebidoEm"
            type="date"
            required
            defaultValue={initial.receivedOn}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`fc-comp-${key}`}>
            Competência (mês dos atos, se o extrato informar)
          </Label>
          <Input
            id={`fc-comp-${key}`}
            name="competencia"
            type="month"
            defaultValue={initial.competence}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`fc-payer-${key}`}>Pago por</Label>
          <Input
            id={`fc-payer-${key}`}
            name="pagador"
            required
            maxLength={120}
            placeholder="Ex.: ANOREG/RN"
            defaultValue={initial.payer}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`fc-rec-${key}`}>Valor recebido (R$)</Label>
          <Input
            id={`fc-rec-${key}`}
            name="recebido"
            required
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={initial.received}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`fc-ret-${key}`}>
            Imposto retido na fonte (R$, se houver)
          </Label>
          <Input
            id={`fc-ret-${key}`}
            name="retido"
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={initial.withheld}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`fc-notes-${key}`}>Observações</Label>
          <Textarea
            id={`fc-notes-${key}`}
            name="observacoes"
            rows={1}
            maxLength={5000}
            defaultValue={initial.notes}
          />
        </div>
      </div>
      <Button type="submit" disabled={pending} className="self-start">
        {pending
          ? "Salvando..."
          : initial.id
            ? "Salvar correção"
            : "Lançar repasse"}
      </Button>
    </form>
  );
}

/** Edit in place: the row opens its own form. */
export function EditFcrcpn({ initial }: { initial: FcrcpnInitial }) {
  const [open, setOpen] = useState(false);
  return open ? (
    <div className="mt-3 basis-full rounded-lg border bg-muted/40 p-3">
      <FcrcpnForm initial={initial} onDone={() => setOpen(false)} />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-2"
        onClick={() => setOpen(false)}
      >
        Cancelar
      </Button>
    </div>
  ) : (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => setOpen(true)}
    >
      Editar
    </Button>
  );
}

export function RemoveFcrcpnButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(removeFcrcpn, IDLE);
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Excluir"
      question="Excluir este repasse?"
      consequence="Ele sai do semestre, mas continua guardado, com a justificativa."
      confirmLabel="Excluir"
      pendingLabel="Excluindo..."
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmAction>
  );
}

/** "Não houve repasse do FCRCPN neste semestre", or that undone. */
export function NoFcrcpnButton({
  semester,
  declared,
}: {
  semester: string;
  declared: boolean;
}) {
  const [state, action, pending] = useActionState(declareNoFcrcpn, IDLE);
  return (
    <form action={action} className="flex flex-col gap-2">
      <Feedback state={state} />
      <input type="hidden" name="semestre" value={semester} />
      <input type="hidden" name="nenhum" value={declared ? "nao" : "sim"} />
      <Button
        type="submit"
        variant="outline"
        disabled={pending}
        className="self-start"
      >
        {declared
          ? "Desfazer: houve repasse"
          : "Não houve repasse neste semestre"}
      </Button>
    </form>
  );
}
