"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { signHref } from "@/app/admin/_components/sign-or-print";
import { slotEndTime } from "@/core/scheduling/agenda.ts";
import { appointmentStatusLabel } from "@/core/scheduling/appointment.ts";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import { Badge } from "../../../_ui/badge.tsx";
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import { cn } from "../../../_ui/cn.ts";
import { Input } from "../../../_ui/input.tsx";
import { Label } from "../../../_ui/label.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../_ui/native-select.tsx";
import { Textarea } from "../../../_ui/textarea.tsx";
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

/** The label over each field of the inline forms. */
const fieldLabelClass = "text-xs font-medium text-foreground";

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
      <p className="border-t px-5 py-8 text-center text-sm text-muted-foreground">
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
    <div className="@container border-t">
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
      className={cn(
        "border-b px-5 py-3.5 text-sm last:border-b-0",
        live && "border-l-4 border-l-primary bg-primary/10",
      )}
    >
      <div className="grid grid-cols-[76px_1fr] items-center gap-3 @2xl:grid-cols-[76px_1fr_auto]">
        <span className="font-semibold tabular-nums text-primary">
          {live && (
            // A booked time calls the eye, the free ones stay quiet.
            <span className="relative mr-1.5 inline-flex h-2.5 w-2.5 align-middle">
              <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
          )}
          {appointment.slotTime}
          <span className="block text-xs font-normal text-muted-foreground">
            até {slotEndTime(appointment.slotTime)}
          </span>
        </span>
        <span className="min-w-0" title={appointment.email}>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 @2xl:flex-nowrap">
            <span className="min-w-0 font-medium text-foreground @2xl:truncate">
              {appointment.citizenName}
            </span>
            {deskBooked ? (
              <Badge className={cn("shrink-0", DESK_BADGE_STYLE)}>
                Reservado no balcão
              </Badge>
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
              className={cn(
                buttonVariants({ variant: "outline", size: "xs" }),
                "text-primary",
              )}
            >
              Detalhes
            </Link>
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground @2xl:truncate">
            {appointment.serviceLabel} · {appointment.mode} ·{" "}
            {appointment.phone}
            {appointment.protocolNumber && (
              <>
                {" · "}
                <span className="font-medium text-primary">
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
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setCancelling((open) => !open)}
            >
              Cancelar
            </Button>
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
        <p className="mt-1.5 inline-flex rounded-md bg-warning px-2.5 py-1 text-xs font-medium text-warning-foreground">
          O horário passou: marque se foi atendido ou não compareceu.
        </p>
      )}

      {appointment.serviceDetails && (
        <p className="mt-1.5 break-words text-xs leading-relaxed text-foreground">
          <span className="font-medium">O que precisa:</span>{" "}
          {appointment.serviceDetails}
        </p>
      )}

      {appointment.files && appointment.files.length > 0 && (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground">
          <span className="font-medium">Enviou antes:</span>
          {appointment.files.map((file) => (
            <a
              key={file.id}
              href={`/admin/agenda/arquivo?id=${file.id}`}
              target="_blank"
              rel="noopener"
              className="inline-flex max-w-[220px] items-center gap-1 truncate rounded-md bg-muted px-2 py-0.5 font-medium text-primary underline-offset-2 hover:underline"
            >
              {file.name}
            </a>
          ))}
        </p>
      )}

      {appointment.cancelReason && (
        <p className="mt-1.5 text-xs text-muted-foreground">
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
    <div className="border-b bg-muted/40 px-5 py-3.5 text-sm last:border-b-0">
      <div className="grid grid-cols-[76px_1fr] items-center gap-3 @2xl:grid-cols-[76px_1fr_auto]">
        <span className="font-semibold tabular-nums text-muted-foreground">
          {time}
        </span>
        <span className="text-muted-foreground">
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setReserving((open) => !open)}
            className="col-span-2 justify-self-start border-dashed text-muted-foreground @2xl:col-span-1 @2xl:justify-self-end"
          >
            Reservar para um cidadão
          </Button>
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
  const uid = useId();

  if (state.status === "success") {
    return (
      <p className="mt-2.5 rounded-lg border border-success/30 bg-success-soft px-3 py-2 text-xs font-medium text-success-text">
        {state.message ?? "Horário reservado."}
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-2.5 rounded-lg border bg-card p-3">
      <input type="hidden" name="agenda" value={agenda} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="slotTime" value={time} />
      <div className="grid gap-2.5 sm:grid-cols-2">
        <label htmlFor={`${uid}-name`} className={fieldLabelClass}>
          Nome do cidadão
          <Input
            id={`${uid}-name`}
            name="citizenName"
            required
            className="mt-1 bg-background font-normal"
          />
        </label>
        <label htmlFor={`${uid}-phone`} className={fieldLabelClass}>
          Telefone
          <Input
            id={`${uid}-phone`}
            name="phone"
            required
            className="mt-1 bg-background font-normal"
            placeholder="(84) 9 9999-9999"
          />
        </label>
        <label
          htmlFor={`${uid}-email`}
          className={cn(fieldLabelClass, "sm:col-span-2")}
        >
          E-mail
          <span className="ml-1 font-normal text-muted-foreground">
            · opcional; com ele o cidadão recebe a confirmação
          </span>
          <Input
            id={`${uid}-email`}
            name="email"
            type="email"
            className="mt-1 bg-background font-normal"
          />
        </label>
        <label htmlFor={`${uid}-service`} className={fieldLabelClass}>
          Serviço
          <NativeSelect
            id={`${uid}-service`}
            name="serviceId"
            required
            defaultValue=""
            className="mt-1 w-full font-normal"
          >
            <NativeSelectOption value="" disabled>
              Escolha o serviço
            </NativeSelectOption>
            {services.map((service) => (
              <NativeSelectOption key={service.id} value={service.id}>
                {service.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label htmlFor={`${uid}-mode`} className={fieldLabelClass}>
          Modo
          <NativeSelect
            id={`${uid}-mode`}
            name="mode"
            required
            defaultValue=""
            className="mt-1 w-full font-normal"
          >
            <NativeSelectOption value="" disabled>
              Escolha o modo
            </NativeSelectOption>
            {modes.map((mode) => (
              <NativeSelectOption key={mode} value={mode}>
                {mode}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
      </div>
      {state.status === "error" && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">
          {state.message}
        </p>
      )}
      <div className="mt-2.5 flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Reservando..." : "Reservar"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          Voltar
        </Button>
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
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Comprovante
      </a>
      <a
        href={signHref(pdf, "Comprovante de agendamento")}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "text-primary",
        )}
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
      <NativeSelect
        size="sm"
        aria-label="Quem assina a declaração"
        value={signer}
        onChange={(event) => setSigner(event.target.value)}
        className="bg-background"
      >
        {signers.map((s, index) => (
          <NativeSelectOption key={`${s.name}-${index}`} value={String(index)}>
            Assina: {[s.name, s.title].filter(Boolean).join(", ")}
          </NativeSelectOption>
        ))}
        <NativeSelectOption value="">
          Assina: quem estiver no balcão
        </NativeSelectOption>
      </NativeSelect>
      <a href={sign} className={buttonVariants({ size: "sm" })}>
        Declaração: assinar digitalmente
      </a>
      <a
        href={pdf}
        target="_blank"
        rel="noopener"
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "border-primary text-primary",
        )}
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
      <Button
        type="submit"
        size="sm"
        disabled={pending}
        title={state.status === "error" ? state.message : undefined}
      >
        {pending ? "..." : "Marcar atendido"}
      </Button>
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
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={pending}
        title="Marcou errado? Volta para agendado, para marcar de novo."
        className="text-primary"
      >
        {pending ? "..." : "Desfazer"}
      </Button>
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
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={pending}
        title={state.status === "error" ? state.message : undefined}
      >
        {pending ? "..." : "Não compareceu"}
      </Button>
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
      <p className="mt-2.5 rounded-lg border border-success/30 bg-success-soft px-3 py-2 text-xs font-medium text-success-text">
        {state.message ?? "Agendamento cancelado."}
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-2.5 rounded-lg bg-muted/50 p-3">
      <input type="hidden" name="id" value={id} />
      <Label htmlFor={`reason-${id}`} className="mb-1.5 gap-0 text-xs">
        Motivo do cancelamento
        <span className="ml-1 font-normal text-muted-foreground">
          · vai no e-mail para {citizenName.split(/\s+/)[0]}
        </span>
      </Label>
      <Textarea
        id={`reason-${id}`}
        name="reason"
        rows={2}
        required
        className="field-sizing-fixed bg-background"
        placeholder="Ex.: o tabelião foi convocado para uma diligência neste horário."
      />
      {state.status === "error" && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">
          {state.message}
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Cancelando..." : "Cancelar e avisar"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          Voltar
        </Button>
      </div>
    </form>
  );
}
