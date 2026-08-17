"use client";

import { useActionState, useState } from "react";
import { slotEndTime } from "@/core/scheduling/agenda.ts";
import { appointmentStatusLabel } from "@/core/scheduling/appointment.ts";
import {
  type ActionState,
  attendAppointment,
  cancelOneAppointment,
  closeAgendaDay,
  reopenAgendaDay,
} from "../actions.ts";
import { AppointmentStatusBadge } from "./status-badge.tsx";

export interface DayAppointment {
  id: string;
  slotTime: string;
  citizenName: string;
  email: string;
  phone: string;
  cpf: string | null;
  serviceLabel: string;
  mode: string;
  status: string;
  cancelReason: string | null;
}

export function DayAgenda({
  date,
  appointments,
  closedReason,
}: {
  date: string;
  appointments: DayAppointment[];
  closedReason?: string;
}) {
  const live = appointments.filter((a) => a.status === "booked");

  return (
    <div className="flex flex-col gap-4.5">
      {closedReason ? (
        <ClosedDayBanner date={date} reason={closedReason} />
      ) : (
        <CloseDayForm date={date} liveCount={live.length} />
      )}

      <div className="overflow-hidden rounded-[14px] border border-admin-border bg-admin-card">
        <div className="grid grid-cols-[92px_1.5fr_1.3fr_128px_120px] gap-2 border-b border-admin-border px-5 py-2.5 text-[11px] font-bold tracking-[0.06em] text-admin-faint uppercase">
          <span>Horário</span>
          <span>Cidadão</span>
          <span>Serviço</span>
          <span>Situação</span>
          <span />
        </div>

        {appointments.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-admin-muted">
            Nenhum agendamento neste dia.
          </p>
        ) : (
          appointments.map((appointment) => (
            <AppointmentRow key={appointment.id} appointment={appointment} />
          ))
        )}
      </div>
    </div>
  );
}

function AppointmentRow({ appointment }: { appointment: DayAppointment }) {
  const [cancelling, setCancelling] = useState(false);
  const live = appointment.status === "booked";

  return (
    <div className="border-b border-admin-border px-5 py-3 text-[13px] last:border-b-0">
      <div className="grid grid-cols-[92px_1.5fr_1.3fr_128px_120px] items-center gap-2">
        <span className="font-bold tabular-nums text-admin-primary">
          {appointment.slotTime}
          <span className="block text-[10.5px] font-normal text-admin-faint">
            até {slotEndTime(appointment.slotTime)}
          </span>
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold text-admin-text">
            {appointment.citizenName}
          </span>
          <span className="block truncate text-[11.5px] text-admin-faint">
            {appointment.email} · {appointment.phone}
            {appointment.cpf ? ` · ${appointment.cpf}` : ""}
          </span>
        </span>
        <span className="min-w-0">
          <span className="block truncate text-admin-text">
            {appointment.serviceLabel}
          </span>
          <span className="block truncate text-[11.5px] text-admin-faint">
            {appointment.mode}
          </span>
        </span>
        <AppointmentStatusBadge
          status={appointment.status}
          label={appointmentStatusLabel(appointment.status)}
        />
        {live ? (
          <span className="flex justify-end gap-1.5">
            <AttendButton id={appointment.id} />
            <button
              type="button"
              onClick={() => setCancelling((open) => !open)}
              className="rounded-lg border border-admin-border px-2.5 py-1.5 text-[11.5px] font-semibold text-admin-muted hover:bg-admin-input-bg"
            >
              Cancelar
            </button>
          </span>
        ) : (
          <span />
        )}
      </div>

      {appointment.cancelReason && (
        <p className="mt-1.5 text-[11.5px] text-admin-muted">
          Motivo informado: {appointment.cancelReason}
        </p>
      )}

      {cancelling && live && (
        <CancelForm
          id={appointment.id}
          onDone={() => setCancelling(false)}
          citizenName={appointment.citizenName}
        />
      )}
    </div>
  );
}

function AttendButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    attendAppointment,
    { status: "idle" },
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        title={state.status === "error" ? state.message : undefined}
        className="rounded-lg bg-admin-primary px-2.5 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-60"
      >
        {pending ? "..." : "Atendido"}
      </button>
    </form>
  );
}

/** The reason is required by the action, and it is what the citizen reads in
 * the e-mail, so the field says so instead of being an anonymous box. */
function CancelForm({
  id,
  citizenName,
  onDone,
}: {
  id: string;
  citizenName: string;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    cancelOneAppointment,
    { status: "idle" },
  );

  if (state.status === "success") {
    return (
      <p className="mt-2.5 rounded-lg bg-admin-success-bg px-3 py-2 text-[12px] font-semibold text-admin-success-text">
        {state.message ?? "Agendamento cancelado."}
      </p>
    );
  }

  return (
    <form
      action={formAction}
      className="mt-2.5 rounded-lg bg-admin-input-bg p-3"
    >
      <input type="hidden" name="id" value={id} />
      <label
        htmlFor={`reason-${id}`}
        className="mb-1.5 block text-[12px] font-semibold text-admin-text"
      >
        Motivo do cancelamento
        <span className="ml-1 font-normal text-admin-faint">
          · vai no e-mail para {citizenName.split(/\s+/)[0]}
        </span>
      </label>
      <textarea
        id={`reason-${id}`}
        name="reason"
        rows={2}
        required
        className="w-full rounded-lg border border-admin-border bg-admin-card px-3 py-2 text-[13px] text-admin-text outline-none focus:border-admin-accent"
        placeholder="Ex.: o tabelião foi convocado para uma diligência neste horário."
      />
      {state.status === "error" && (
        <p
          role="alert"
          className="mt-1.5 text-[12px] font-semibold text-admin-alert"
        >
          {state.message}
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-admin-primary px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Cancelando..." : "Cancelar e avisar"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg border border-admin-border px-3 py-1.5 text-[12px] font-semibold text-admin-muted"
        >
          Voltar
        </button>
      </div>
    </form>
  );
}

/** Closing the day: one reason, every citizen of the date warned. */
function CloseDayForm({
  date,
  liveCount,
}: {
  date: string;
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

  if (!open) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[14px] border border-admin-border bg-admin-card px-5 py-3.5">
        <p className="text-[12.5px] text-admin-muted">
          Não vai haver atendimento neste dia? Feche a data: os agendamentos são
          cancelados, os cidadãos são avisados por e-mail e o site deixa de
          oferecer o dia.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-lg border border-admin-border px-3 py-2 text-[12.5px] font-semibold text-admin-muted hover:bg-admin-input-bg"
        >
          Fechar o dia
        </button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4"
    >
      <input type="hidden" name="date" value={date} />
      <div className="text-[13px] font-bold text-admin-primary">
        Fechar este dia
      </div>
      <p className="mt-1 text-[12.5px] text-admin-muted">
        {liveCount === 0
          ? "Não há agendamentos para cancelar; o dia só deixa de ser oferecido."
          : `${liveCount} ${liveCount === 1 ? "agendamento será cancelado e o cidadão será avisado" : "agendamentos serão cancelados e os cidadãos avisados"} por e-mail.`}
      </p>
      <label
        htmlFor="close-reason"
        className="mt-3 mb-1.5 block text-[12px] font-semibold text-admin-text"
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
  );
}

function ClosedDayBanner({ date, reason }: { date: string; reason: string }) {
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
    <div className="flex items-start justify-between gap-3 rounded-[14px] border border-admin-warning-border bg-admin-warning-bg px-5 py-3.5">
      <div>
        <div className="text-[13px] font-bold text-admin-warning-text">
          Este dia está fechado
        </div>
        {/* O motivo é frase inteira, escrita pela serventia, e quase sempre já
            termina em ponto. Fica no seu próprio parágrafo em vez de embutido
            numa frase maior, que produziria "...no prédio.. O site...". */}
        <p className="mt-1 text-[12.5px] text-admin-warning-text">
          Motivo informado: {reason}
        </p>
        <p className="mt-1 text-[12.5px] text-admin-warning-text">
          O site não oferece esta data. Reabrir volta a oferecer os horários
          livres; os agendamentos já cancelados seguem cancelados.
        </p>
      </div>
      <form action={formAction} className="shrink-0">
        <input type="hidden" name="date" value={date} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-admin-border bg-admin-card px-3 py-2 text-[12.5px] font-semibold text-admin-muted disabled:opacity-60"
        >
          {pending ? "Reabrindo..." : "Reabrir o dia"}
        </button>
      </form>
    </div>
  );
}
