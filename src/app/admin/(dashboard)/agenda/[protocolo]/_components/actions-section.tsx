"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  type ActionState,
  cancelAppointment,
  confirmAppointment,
  markAppointmentAttended,
} from "../actions.ts";
import { type DayOption, ProposeSlotPicker } from "./propose-slot-picker.tsx";

function ActionButton({
  requestId,
  label,
  pendingLabel,
  successMessage,
  action,
  className,
}: {
  requestId: string;
  label: string;
  pendingLabel: string;
  successMessage: string;
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
  className: string;
}) {
  const [state, boundAction, pending] = useActionState<ActionState, FormData>(
    action,
    { status: "idle" },
  );

  useEffect(() => {
    if (state.status === "success") toast.success(successMessage);
    if (state.status === "error") toast.error(state.message);
  }, [state, successMessage]);

  return (
    <form action={boundAction}>
      <input type="hidden" name="requestId" value={requestId} />
      <button type="submit" disabled={pending} className={className}>
        {pending ? pendingLabel : label}
      </button>
      {state.status === "error" && (
        <p
          role="alert"
          className="mt-1.5 text-[12px] font-semibold text-admin-error-text"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}

/** Cancelling is terminal, so the destructive button only arms the inline
 * confirmation panel — same closed-button/open-panel shape as the
 * `ProposeSlotPicker` beside it. */
function CancelRequestButton({
  requestId,
  protocolNumber,
}: {
  requestId: string;
  protocolNumber: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, boundAction, pending] = useActionState<ActionState, FormData>(
    cancelAppointment,
    { status: "idle" },
  );

  useEffect(() => {
    if (state.status === "success") toast.success("Pedido cancelado.");
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-[9px] border border-admin-error-border px-4 py-2.5 text-[12.5px] font-bold text-admin-error-text"
      >
        Cancelar pedido
      </button>
    );
  }

  return (
    <div className="mt-3.5 w-full rounded-[11px] border border-admin-error-border bg-admin-card p-4">
      <h4 className="font-serif text-[15px] font-semibold text-admin-primary">
        Cancelar este pedido?
      </h4>
      <p className="mt-1.5 text-[12.5px] leading-snug text-admin-text">
        O pedido {protocolNumber} será encerrado e a faixa ficará livre. O
        cidadão vê o cancelamento na consulta de protocolo. Não dá para
        desfazer.
      </p>
      <form action={boundAction} className="mt-3 flex items-center gap-2.5">
        <input type="hidden" name="requestId" value={requestId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-[9px] border border-admin-error-border px-4 py-2.5 text-[12.5px] font-bold text-admin-error-text disabled:opacity-60"
        >
          {pending ? "Cancelando…" : "Cancelar pedido"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-[12px] font-semibold text-admin-muted"
        >
          Voltar
        </button>
      </form>
      {state.status === "error" && (
        <p
          role="alert"
          className="mt-2 text-[12px] font-semibold text-admin-error-text"
        >
          {state.message}
        </p>
      )}
    </div>
  );
}

export function ActionsSection({
  requestId,
  protocolNumber,
  status,
  days,
}: {
  requestId: string;
  protocolNumber: string;
  status: string;
  days: DayOption[];
}) {
  const canAct = status === "requested" || status === "proposed";
  const canAttend = status === "confirmed";

  if (!canAct && !canAttend) return null;

  return (
    <div className="mt-5 border-t border-admin-border pt-4.5">
      <div className="flex flex-wrap items-center gap-2.5">
        {canAct && (
          <ActionButton
            requestId={requestId}
            label="Confirmar este horário"
            pendingLabel="Confirmando…"
            successMessage="Horário confirmado."
            action={confirmAppointment}
            className="rounded-[9px] bg-admin-primary-soft px-4.5 py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
          />
        )}
        {canAttend && (
          <ActionButton
            requestId={requestId}
            label="Marcar como atendido"
            pendingLabel="Marcando…"
            successMessage="Atendimento registrado."
            action={markAppointmentAttended}
            className="rounded-[9px] bg-admin-primary-soft px-4.5 py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
          />
        )}
        {canAct && <ProposeSlotPicker requestId={requestId} days={days} />}
        <CancelRequestButton
          requestId={requestId}
          protocolNumber={protocolNumber}
        />
      </div>
      <p className="mt-2.5 text-[11.5px] text-admin-faint">
        {canAct
          ? "Confirmar reserva a faixa pedida. Propor outro horário mostra as mesmas faixas livres do formulário público — o cidadão aceita pela consulta de protocolo."
          : "Marcar como atendido conclui o pedido. Cancelar libera a faixa — o cidadão vê a mudança pela consulta de protocolo."}
      </p>
    </div>
  );
}
