"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { signHref } from "@/app/admin/_components/sign-or-print";
import { slotEndTime } from "@/core/scheduling/agenda.ts";
import { appointmentStatusLabel } from "@/core/scheduling/appointment.ts";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import {
  type ActionState,
  attendAppointment,
  cancelOneAppointment,
  markAppointmentNoShow,
  removeAppointmentAction,
  reserveDeskAppointment,
  revertAppointmentStatus,
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
  serviceDetails: string | null;
  status: string;
  origin: string;
  protocolNumber: string | null;
  cancelReason: string | null;
  /** Documents the citizen sent ahead from the protocol consult. */
  files?: { id: string; name: string }[];
  /** Its hour is over and nobody said whether the citizen came. */
  awaitingConfirmation?: boolean;
  /** Attended in person: the attendance declaration can be printed. */
  canDeclare?: boolean;
}

export type DayRow =
  | { kind: "appointment"; time: string; appointment: DayAppointment }
  | { kind: "free"; time: string; vacancies?: number }
  | { kind: "idle"; time: string }
  /** A time of this agenda held by an appointment of the other one, while
   * the two agendas still share their times. */
  | { kind: "held"; time: string; heldBy: string };

const inputClass =
  "w-full rounded-lg border border-admin-border bg-admin-card px-3 py-2 text-[13px] text-admin-text outline-none focus:border-admin-accent";

/**
 * The whole day, hour by hour: who is coming, and which hours the site is
 * still offering. A free hour is a row too: it is the thing the office can
 * hand to whoever is on the phone ("Reservar para um cidadão").
 */
export function DaySlotList({
  agenda,
  date,
  rows,
  services,
  modes,
  closed,
  signers = [],
}: {
  agenda: string;
  date: string;
  rows: DayRow[];
  services: Array<{ id: string; label: string }>;
  modes: string[];
  closed: boolean;
  /** Who may sign the office's papers (the guias' list). */
  signers?: Signer[];
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

  // A container, not a viewport breakpoint: the list's width depends on the
  // panel's sidebar and the day's side column, so at a 1024px window it is
  // narrower than on a large phone held sideways. Each row reads this width to
  // decide whether its actions fit beside the text or go under it.
  return (
    <div className="@container border-t border-admin-border">
      {rows.map((row) =>
        row.kind === "appointment" ? (
          <AppointmentRow
            key={row.appointment.id}
            appointment={row.appointment}
            signers={signers}
          />
        ) : (
          <FreeSlotRow
            key={`slot-${row.time}`}
            agenda={agenda}
            date={date}
            time={row.time}
            offered={row.kind === "free"}
            vacancies={row.kind === "free" ? row.vacancies : undefined}
            heldBy={row.kind === "held" ? row.heldBy : undefined}
            closed={closed}
            services={services}
            modes={modes}
          />
        ),
      )}
    </div>
  );
}

interface Signer {
  name: string;
  title: string;
}

function AppointmentRow({
  appointment,
  signers,
}: {
  appointment: DayAppointment;
  signers: Signer[];
}) {
  const [cancelling, setCancelling] = useState(false);
  const live = appointment.status === "booked";
  const deskBooked = live && appointment.origin === "desk";

  return (
    <div
      className={`border-b border-admin-border px-5 py-3.5 text-[13px] last:border-b-0 ${
        live ? "border-l-4 border-l-admin-accent bg-admin-warning-soft-bg" : ""
      }`}
    >
      <div className="grid grid-cols-[76px_1fr] items-center gap-3 @2xl:grid-cols-[76px_1fr_auto]">
        <span className="font-bold tabular-nums text-admin-primary">
          {live && (
            // A booked time calls the eye, the free ones stay quiet.
            <span className="relative mr-1.5 inline-flex h-2.5 w-2.5 align-middle">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-admin-accent opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-admin-accent" />
            </span>
          )}
          {appointment.slotTime}
          <span className="block text-[10.5px] font-normal text-admin-faint">
            até {slotEndTime(appointment.slotTime)}
          </span>
        </span>
        <span className="min-w-0" title={appointment.email}>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 @2xl:flex-nowrap">
            <span className="min-w-0 font-semibold text-admin-text @2xl:truncate">
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
            {/* What the citizen wrote and sent, the office's notes and files,
                and the citizen's data to correct. */}
            <Link
              href={`/admin/agenda/agendamento/${appointment.id}`}
              className="shrink-0 rounded-lg border border-admin-border px-2 py-0.5 text-[11px] font-semibold text-admin-primary hover:bg-admin-input-bg"
            >
              Detalhes
            </Link>
          </span>
          <span className="mt-0.5 block text-[11.5px] text-admin-faint @2xl:truncate">
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
          <span className="col-span-2 flex flex-wrap gap-1.5 @2xl:col-span-1 @2xl:justify-end">
            <ReceiptLink id={appointment.id} />
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
        ) : appointment.status === "attended" ? (
          <span className="col-span-2 flex flex-wrap gap-1.5 @2xl:col-span-1 @2xl:justify-end">
            <ReceiptLink id={appointment.id} />
            {appointment.canDeclare && (
              <DeclarationLink id={appointment.id} signers={signers} />
            )}
            <RevertButton id={appointment.id} />
            <RemoveButton
              id={appointment.id}
              citizenName={appointment.citizenName}
            />
          </span>
        ) : (
          <span className="col-span-2 flex flex-wrap gap-1.5 @2xl:col-span-1 @2xl:justify-end">
            {appointment.status === "no_show" && (
              <RevertButton id={appointment.id} />
            )}
            <RemoveButton
              id={appointment.id}
              citizenName={appointment.citizenName}
            />
          </span>
        )}
      </div>

      {appointment.awaitingConfirmation && (
        <p className="mt-1.5 inline-flex rounded-md bg-admin-warning-bg px-2.5 py-1 text-[11.5px] font-semibold text-admin-warning-text">
          O horário passou: marque se foi atendido ou não compareceu.
        </p>
      )}

      {appointment.serviceDetails && (
        <p className="mt-1.5 break-words text-[12px] leading-relaxed text-admin-text">
          <span className="font-semibold">O que precisa:</span>{" "}
          {appointment.serviceDetails}
        </p>
      )}

      {appointment.files && appointment.files.length > 0 && (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-admin-text">
          <span className="font-semibold">Enviou antes:</span>
          {appointment.files.map((file) => (
            <a
              key={file.id}
              href={`/admin/agenda/arquivo?id=${file.id}`}
              target="_blank"
              rel="noopener"
              className="inline-flex max-w-[220px] items-center gap-1 truncate rounded-md bg-admin-input-bg px-2 py-0.5 font-semibold text-admin-primary underline-offset-2 hover:underline"
            >
              {file.name}
            </a>
          ))}
        </p>
      )}

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
 * by unbooked and there is nothing to act on. On a closed day no hour is
 * offered, past or not, and saying "já passou" of an hour next week is false:
 * the row says the day is closed instead.
 */
function FreeSlotRow({
  agenda,
  date,
  time,
  offered,
  vacancies,
  heldBy,
  closed,
  services,
  modes,
}: {
  agenda: string;
  date: string;
  time: string;
  offered: boolean;
  /** How many citizens the time still takes, when more than one. */
  vacancies?: number;
  heldBy?: string;
  closed: boolean;
  services: Array<{ id: string; label: string }>;
  modes: string[];
}) {
  const [reserving, setReserving] = useState(false);

  return (
    <div className="border-b border-admin-border bg-admin-input-bg/40 px-5 py-3.5 text-[13px] last:border-b-0">
      <div className="grid grid-cols-[76px_1fr] items-center gap-3 @2xl:grid-cols-[76px_1fr_auto]">
        <span className="font-bold tabular-nums text-admin-faint">{time}</span>
        <span className="text-admin-muted">
          {offered
            ? vacancies && vacancies > 1
              ? `Livre: ${vacancies} vagas aparecem no site para agendamento`
              : "Livre: aparece no site para agendamento"
            : heldBy
              ? `Ocupado por um agendamento da agenda ${heldBy}`
              : closed
                ? "Dia fechado: não aparece no site"
                : "Ficou livre: o horário já passou"}
        </span>
        {offered ? (
          <button
            type="button"
            onClick={() => setReserving((open) => !open)}
            className="col-span-2 justify-self-start rounded-lg border border-dashed border-admin-border px-2.5 py-1.5 text-[11.5px] font-semibold text-admin-muted hover:bg-admin-input-bg @2xl:col-span-1 @2xl:justify-self-end"
          >
            Reservar para um cidadão
          </button>
        ) : (
          <span className="hidden @2xl:block" />
        )}
      </div>
      {reserving && offered && (
        <DeskReserveForm
          agenda={agenda}
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
  agenda,
  date,
  time,
  services,
  modes,
  onDone,
}: {
  agenda: string;
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
      <input type="hidden" name="agenda" value={agenda} />
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

/** The citizen's receipt, with the list of what to bring, printed at the
 * counter: for a visit reserved by phone, or a citizen without theirs. */
function ReceiptLink({ id }: { id: string }) {
  const pdf = `/admin/agenda/comprovante/${id}`;
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      <a
        href={pdf}
        target="_blank"
        rel="noopener"
        className="rounded-lg border border-admin-border px-2.5 py-1.5 text-[11.5px] font-semibold text-admin-muted hover:bg-admin-input-bg"
      >
        Comprovante
      </a>
      <a
        href={signHref(pdf, "Comprovante de agendamento")}
        className="rounded-lg border border-admin-border px-2.5 py-1.5 text-[11.5px] font-semibold text-admin-primary hover:bg-admin-input-bg"
        title="Assinar o comprovante digitalmente"
      >
        Assinar
      </a>
    </span>
  );
}

/**
 * The attendance declaration: signed digitally through the platform, or
 * printed to sign and stamp at the counter (decision of 11/11/2026).
 */
function DeclarationLink({ id, signers }: { id: string; signers: Signer[] }) {
  // Who signs, as in the guias: the line under the signature says it, on
  // the digital and on the printed one alike (decision of 11/11/2026).
  const [signer, setSigner] = useState(signers.length ? "0" : "");
  const pdf = `/admin/agenda/comparecimento/${id}${signer ? `?assina=${signer}` : ""}`;
  const sign = signHref(pdf, "Declaração de comparecimento");
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <select
        aria-label="Quem assina a declaração"
        value={signer}
        onChange={(event) => setSigner(event.target.value)}
        className="rounded-lg border border-admin-border bg-admin-card px-2 py-1.5 text-[11.5px] text-admin-text"
      >
        {signers.map((s, index) => (
          <option key={`${s.name}-${index}`} value={String(index)}>
            Assina: {[s.name, s.title].filter(Boolean).join(", ")}
          </option>
        ))}
        <option value="">Assina: quem estiver no balcão</option>
      </select>
      <a
        href={sign}
        className="rounded-lg bg-admin-primary px-2.5 py-1.5 text-[11.5px] font-semibold text-white"
      >
        Declaração: assinar digitalmente
      </a>
      <a
        href={pdf}
        target="_blank"
        rel="noopener"
        className="rounded-lg border border-admin-primary px-2.5 py-1.5 text-[11.5px] font-semibold text-admin-primary"
        title="Abre o PDF para imprimir e assinar à mão"
      >
        Imprimir para assinar à mão
      </a>
    </span>
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

/** Back to "Agendado", for a status marked by mistake. */
function RevertButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    revertAppointmentStatus,
    { status: "idle" },
  );
  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? "Desfeito.");
    if (state.status === "error") toast.error(state.message);
  }, [state]);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        title="Marcou errado? Volta para agendado, para marcar de novo."
        className="rounded-lg border border-admin-border px-2.5 py-1.5 text-[11.5px] font-semibold text-admin-primary hover:bg-admin-input-bg disabled:opacity-60"
      >
        {pending ? "..." : "Desfazer"}
      </button>
    </form>
  );
}

/** Off the agenda, with a confirmation: the record stays in the database. */
function RemoveButton({
  id,
  citizenName,
}: {
  id: string;
  citizenName: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    removeAppointmentAction,
    { status: "idle" },
  );
  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message ?? "Agendamento excluído.");
    }
  }, [state]);
  return (
    <ConfirmAction
      action={formAction}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Excluir"
      question={`Excluir o agendamento de ${citizenName.split(/\s+/)[0]}?`}
      consequence="Ele sai da agenda e o horário fica livre de novo. O registro fica guardado no sistema, com quem excluiu e quando. O cidadão não recebe e-mail: para avisá-lo, use Cancelar."
      confirmLabel="Excluir da agenda"
      pendingLabel="Excluindo..."
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmAction>
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
        {pending ? "..." : "Não compareceu"}
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
