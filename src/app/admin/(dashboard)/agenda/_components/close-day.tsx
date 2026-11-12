"use client";

import { useActionState, useState } from "react";
import { Button } from "../../../_ui/button.tsx";
import { Label } from "../../../_ui/label.tsx";
import { Textarea } from "../../../_ui/textarea.tsx";
import {
  type ActionState,
  closeAgendaDay,
  reopenAgendaDay,
} from "../actions.ts";

/** Closing the day: one reason, every citizen of the date warned. Lives in
 * the sidebar as a card, labelled with the date it is about to close. */
export function CloseDayCard({
  date,
  dateLabel,
  liveCount,
}: {
  date: string;
  dateLabel: string;
  liveCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    closeAgendaDay,
    { status: "idle" },
  );

  if (state.status === "success") {
    return (
      <p className="rounded-xl border border-success/30 bg-success-soft px-5 py-3.5 text-sm font-medium text-success-text">
        {state.message ?? "Dia fechado."}
      </p>
    );
  }

  return (
    <section className="rounded-xl border bg-card px-5 py-4">
      <h3 className="text-sm font-semibold text-foreground">Fechar este dia</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {liveCount === 0
          ? `Não há agendamentos em ${dateLabel}; o dia só deixa de ser oferecido no site. Dá para reabrir depois.`
          : `${liveCount === 1 ? `O agendamento de ${dateLabel} é cancelado, o cidadão é avisado` : `Os ${liveCount} agendamentos de ${dateLabel} são cancelados, os cidadãos são avisados`} por e-mail e o dia sai do site. Dá para reabrir depois.`}
      </p>

      {open ? (
        <form action={formAction} className="mt-3">
          <input type="hidden" name="date" value={date} />
          <Label htmlFor="close-reason" className="mb-1.5 gap-0 text-xs">
            Motivo
            <span className="ml-1 font-normal text-muted-foreground">
              · vai no e-mail de todos
            </span>
          </Label>
          <Textarea
            id="close-reason"
            name="reason"
            rows={2}
            required
            className="field-sizing-fixed bg-background"
            placeholder="Ex.: a serventia não abrirá por falta de energia elétrica."
          />
          {state.status === "error" && (
            <p
              role="alert"
              className="mt-1.5 text-xs font-medium text-destructive"
            >
              {state.message}
            </p>
          )}
          <div className="mt-2.5 flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Fechando..." : "Fechar o dia e avisar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Voltar
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => setOpen(true)}
          className="mt-3"
        >
          Fechar {dateLabel}...
        </Button>
      )}
    </section>
  );
}

/** The selected date is closed: say why, and offer the way back. Reopening
 * never revives what was cancelled; the citizens were told. */
export function ClosedDayCard({
  date,
  reason,
}: {
  date: string;
  reason: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    reopenAgendaDay,
    { status: "idle" },
  );

  if (state.status === "success") {
    return (
      <p className="rounded-xl border border-success/30 bg-success-soft px-5 py-3.5 text-sm font-medium text-success-text">
        {state.message ?? "Dia reaberto."}
      </p>
    );
  }

  return (
    <section className="rounded-xl border border-warning/30 bg-warning-soft px-5 py-4">
      <h3 className="text-sm font-semibold text-warning-text">
        Este dia está fechado
      </h3>
      {/* O motivo é frase inteira, escrita pela serventia. Fica no seu próprio
          parágrafo em vez de embutido numa frase maior. */}
      <p className="mt-1 text-xs text-warning-text">
        Motivo informado: {reason}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-warning-text">
        O site não oferece esta data. Reabrir volta a oferecer os horários
        livres; os agendamentos já cancelados seguem cancelados.
      </p>
      <form action={formAction} className="mt-3">
        <input type="hidden" name="date" value={date} />
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Reabrindo..." : "Reabrir o dia"}
        </Button>
      </form>
    </section>
  );
}

/** One-click reopen for the "Dias fechados à frente" list. */
export function ReopenDateButton({ date }: { date: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    reopenAgendaDay,
    { status: "idle" },
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="date" value={date} />
      <Button
        type="submit"
        variant="link"
        size="xs"
        disabled={pending}
        title={state.status === "error" ? state.message : undefined}
        className="h-auto px-0 underline"
      >
        {pending ? "Reabrindo..." : "Reabrir"}
      </Button>
    </form>
  );
}
