"use client";

import { useActionState, useState } from "react";
import { slotEndTime } from "@/core/scheduling/agenda.ts";
import { appointmentStatusLabel } from "@/core/scheduling/appointment.ts";
import {
  type ActionState,
  attendAppointment,
  cancelOneAppointment,
  markAppointmentNoShow,
  reserveDeskAppointment,
} from "../actions.ts";
import { AppointmentStatusBadge, DESK_BADGE_STYLE } from "./status-badge.tsx";

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
  origin: string;
  protocolNumber: string | null;
  cancelReason: string | null;
}

export type DayRow =
  | { kind: "appointment"; time: string; appointment: DayAppointment }
  | { kind: "free"; time: string }
  | { kind: "idle"; time: string };

const inputClass =
  "w-full rounded-lg border border-admin-border bg-admin-card px-3 py-2 text-[13px] text-admin-text outline-none focus:border-admin-accent";

/**
 * The whole day, hour by hour: who is coming, and which hours the site is
 * still offering. A free hour is a row too: it is the thing the office can
 * hand to whoever is on the phone ("Reservar para um cidadão").
 */
export function DaySlotList({
  date,
  rows,
  services,
  modes,
  closed,
}: {
  date: string;
  rows: DayRow[];
  services: Array<{ id: string; label: string }>;
  modes: string[];
  closed: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="border-t border-admin-border px-5 py-8 text-center text-[13px] text-admin-muted">
        {closed
          ? "Dia fechado, sem agendamentos."
          : "Nenhum horário na grade deste dia e nenhum agendamento."}
      </p>
    );
  }

  return (
    <div className="border-t border-admin-border">
      {rows.map((row) =>
        row.kind === "appointment" ? (
          <AppointmentRow
            key={row.appointment.id}
            appointment={row.appointment}
          />
        ) : (
          <FreeSlotRow
            key={`slot-${row.time}`}
            date={date}
            time={row.time}
            offered={row.kind === "free"}
            services={services}
            modes={modes}
          />
        ),
      )}
    </div>
  );
}

function AppointmentRow({ appointment }: { appointment: DayAppointment }) {
  const [cancelling, setCancelling] = useState(false);
  const live = appointment.status === "booked";
  const deskBooked = live && appointment.origin === "desk";

  return (
    <div className="border-b border-admin-border px-5 py-3.5 text-[13px] last:border-b-0">
      <div className="grid grid-cols-[76px_1fr_auto] items-center gap-3">
        <span className="font-bold tabular-nums text-admin-primary">
          {appointment.slotTime}
          <span className="block text-[10.5px] font-normal text-admin-faint">
            até {slotEndTime(appointment.slotTime)}
          </span>
        </span>
        <span className="min-w-0" title={appointment.email}>
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold text-admin-text">
              {appointment.citizenName}
            </span>
            {deskBooked ? (
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${DESK_BADGE_STYLE}`}
              >
                Reservado no balcão
              </span>
            ) : (
              <AppointmentStatusBadge
                status={appointment.status}
                label={appointmentStatusLabel(appointment.status)}
              />
            )}
          </span>
          <span className="mt-0.5 block truncate text-[11.5px] text-admin-faint">
            {appointment.serviceLabel} · {appointment.mode} ·{" "}
            {appointment.phone}
            {appointment.protocolNumber && (
              <>
                {" · "}
                <span className="font-semibold text-admin-accent">
                  {appointment.protocolNumber}
                </span>
              </>
            )}
          </span>
        </span>
        {live ? (
          <span className="flex justify-end gap-1.5">
            <AttendButton id={appointment.id} />
            <NoShowButton id={appointment.id} />
            <button
              type="button"
              onClick={() => setCancelling((open) => !open)}
              className="rounded-lg border border-admin-border px-2.5 py-1.5 text-[11.5px] font-semibold text-admin-alert hover:bg-admin-input-bg"
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

      {/* Not gated on `live`: the revalidated row arrives cancelled in the
          same commit as the form's success state, and gating would unmount
          the confirmation before it ever paints. */}
      {cancelling && (
        <CancelForm
          id={appointment.id}
          onDone={() => setCancelling(false)}
          citizenName={appointment.citizenName}
        />
      )}
    </div>
  );
}

/**
 * A grid hour nobody holds. Offered means the site still shows it, and the
 * office can take it for a citizen at the counter; past means the hour went
 * by unbooked and there is nothing to act on.
 */
function FreeSlotRow({
  date,
  time,
  offered,
  services,
  modes,
}: {
  date: string;
  time: string;
  offered: boolean;
  services: Array<{ id: string; label: string }>;
  modes: string[];
}) {
  const [reserving, setReserving] = useState(false);

  return (
    <div className="border-b border-admin-border bg-admin-input-bg/40 px-5 py-3.5 text-[13px] last:border-b-0">
      <div className="grid grid-cols-[76px_1fr_auto] items-center gap-3">
        <span className="font-bold tabular-nums text-admin-faint">{time}</span>
        <span className="text-admin-muted">
          {offered
            ? "Livre: aparece no site para agendamento"
            : "Ficou livre: o horário já passou"}
        </span>
        {offered ? (
          <button
            type="button"
            onClick={() => setReserving((open) => !open)}
            className="justify-self-end rounded-lg border border-dashed border-admin-border px-2.5 py-1.5 text-[11.5px] font-semibold text-admin-muted hover:bg-admin-input-bg"
          >
            Reservar para um cidadão
          </button>
        ) : (
          <span />
        )}
      </div>
      {reserving && offered && (
        <DeskReserveForm
          date={date}
          time={time}
          services={services}
          modes={modes}
          onDone={() => setReserving(false)}
        />
      )}
    </div>
  );
}

/** The office booking for whoever is on the phone or at the counter. E-mail
 * is optional here; with one, the citizen gets the same confirmation the site
 * sends, cancellation link included. */
function DeskReserveForm({
  date,
  time,
  services,
  modes,
  onDone,
}: {
  date: string;
  time: string;
  services: Array<{ id: string; label: string }>;
  modes: string[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    reserveDeskAppointment,
    { status: "idle" },
  );

  if (state.status === "success") {
    return (
      <p className="mt-2.5 rounded-lg bg-admin-success-bg px-3 py-2 text-[12px] font-semibold text-admin-success-text">
        {state.message ?? "Horário reservado."}
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-2.5 rounded-lg bg-admin-card p-3">
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="slotTime" value={time} />
      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className="text-[12px] font-semibold text-admin-text">
          Nome do cidadão
          <input
            name="citizenName"
            required
            className={`${inputClass} mt-1 font-normal`}
          />
        </label>
        <label className="text-[12px] font-semibold text-admin-text">
          Telefone
          <input
            name="phone"
            required
            className={`${inputClass} mt-1 font-normal`}
            placeholder="(84) 9 9999-9999"
          />
        </label>
        <label className="text-[12px] font-semibold text-admin-text sm:col-span-2">
          E-mail
          <span className="ml-1 font-normal text-admin-faint">
            · opcional; com ele o cidadão recebe a confirmação
          </span>
          <input
            name="email"
            type="email"
            className={`${inputClass} mt-1 font-normal`}
          />
        </label>
        <label className="text-[12px] font-semibold text-admin-text">
          Serviço
          <select
            name="serviceId"
            required
            defaultValue=""
            className={`${inputClass} mt-1 font-normal`}
          >
            <option value="" disabled>
              Escolha o serviço
            </option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px] font-semibold text-admin-text">
          Modo
          <select
            name="mode"
            required
            defaultValue=""
            className={`${inputClass} mt-1 font-normal`}
          >
            <option value="" disabled>
              Escolha o modo
            </option>
            {modes.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </label>
      </div>
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
          className="rounded-lg bg-admin-primary px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Reservando..." : "Reservar"}
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
        {pending ? "..." : "Marcar atendido"}
      </button>
    </form>
  );
}

function NoShowButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    markAppointmentNoShow,
    { status: "idle" },
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        title={state.status === "error" ? state.message : undefined}
        className="rounded-lg border border-admin-border px-2.5 py-1.5 text-[11.5px] font-semibold text-admin-muted hover:bg-admin-input-bg disabled:opacity-60"
      >
        {pending ? "..." : "Faltou"}
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
        className={inputClass}
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
