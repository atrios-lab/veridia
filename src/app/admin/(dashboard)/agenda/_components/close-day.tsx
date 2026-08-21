"use client";

import { useActionState, useState } from "react";
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
      <p className="rounded-[14px] bg-admin-success-bg px-5 py-3.5 text-[13px] font-semibold text-admin-success-text">
        {state.message ?? "Dia fechado."}
      </p>
    );
  }

  return (
    <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
      <h3 className="text-[13px] font-bold text-admin-primary">
        Fechar este dia
      </h3>
      <p className="mt-1 text-[12.5px] leading-relaxed text-admin-muted">
        {liveCount === 0
          ? `Não há agendamentos em ${dateLabel}; o dia só deixa de ser oferecido no site. Dá para reabrir depois.`
          : `${liveCount === 1 ? `O agendamento de ${dateLabel} é cancelado, o cidadão é avisado` : `Os ${liveCount} agendamentos de ${dateLabel} são cancelados, os cidadãos são avisados`} por e-mail e o dia sai do site. Dá para reabrir depois.`}
      </p>

      {open ? (
        <form action={formAction} className="mt-3">
          <input type="hidden" name="date" value={date} />
          <label
            htmlFor="close-reason"
            className="mb-1.5 block text-[12px] font-semibold text-admin-text"
          >
            Motivo
            <span className="ml-1 font-normal text-admin-faint">
              · vai no e-mail de todos
            </span>
          </label>
          <textarea
            id="close-reason"
            name="reason"
            rows={2}
            required
            className="w-full rounded-lg border border-admin-border bg-admin-input-bg px-3 py-2 text-[13px] text-admin-text outline-none focus:border-admin-accent"
            placeholder="Ex.: a serventia não abrirá por falta de energia elétrica."
          />
          {state.status === "error" && (
            <p
              role="alert"
              className="mt-1.5 text-[12px] font-semibold text-admin-alert"
            >
              {state.message}
            </p>
          )}
          <div className="mt-2.5 flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-admin-primary px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Fechando..." : "Fechar o dia e avisar"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-admin-border px-3.5 py-2 text-[12.5px] font-semibold text-admin-muted"
            >
              Voltar
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 rounded-lg border border-admin-border px-3.5 py-2 text-[12.5px] font-semibold text-admin-alert hover:bg-admin-input-bg"
        >
          Fechar {dateLabel}...
        </button>
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
      <p className="rounded-[14px] bg-admin-success-bg px-5 py-3.5 text-[13px] font-semibold text-admin-success-text">
        {state.message ?? "Dia reaberto."}
      </p>
    );
  }

  return (
    <section className="rounded-[14px] border border-admin-warning-border bg-admin-warning-bg px-5 py-4">
      <h3 className="text-[13px] font-bold text-admin-warning-text">
        Este dia está fechado
      </h3>
      {/* O motivo é frase inteira, escrita pela serventia. Fica no seu próprio
          parágrafo em vez de embutido numa frase maior. */}
      <p className="mt-1 text-[12.5px] text-admin-warning-text">
        Motivo informado: {reason}
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-admin-warning-text">
        O site não oferece esta data. Reabrir volta a oferecer os horários
        livres; os agendamentos já cancelados seguem cancelados.
      </p>
      <form action={formAction} className="mt-3">
        <input type="hidden" name="date" value={date} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-admin-border bg-admin-card px-3 py-2 text-[12.5px] font-semibold text-admin-muted disabled:opacity-60"
        >
          {pending ? "Reabrindo..." : "Reabrir o dia"}
        </button>
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
      <button
        type="submit"
        disabled={pending}
        title={state.status === "error" ? state.message : undefined}
        className="text-[12.5px] font-semibold text-admin-accent underline disabled:opacity-60"
      >
        {pending ? "Reabrindo..." : "Reabrir"}
      </button>
    </form>
  );
}
