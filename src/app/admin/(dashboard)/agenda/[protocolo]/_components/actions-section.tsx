"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "../../../../_components/confirm-action.tsx";
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

/** Cancelling is terminal, so it goes through the shared arm-then-confirm
 * panel every destructive action in the panel uses. */
function CancelRequestButton({
  requestId,
  protocolNumber,
}: {
  requestId: string;
  protocolNumber: string;
}) {
  const [state, boundAction, pending] = useActionState<ActionState, FormData>(
    cancelAppointment,
    { status: "idle" },
  );

  // Only the success toast: an error is shown inside the dialog, which stays
  // open for it, and a toast fired under a modal is a toast nobody reads.
  useEffect(() => {
    if (state.status === "success") toast.success("Pedido cancelado.");
  }, [state]);

  return (
    <ConfirmAction
      action={boundAction}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Cancelar pedido"
      question="Cancelar este pedido?"
      consequence={`O pedido ${protocolNumber} será encerrado e a faixa ficará livre. O cidadão vê o cancelamento na consulta de protocolo. Não dá para desfazer.`}
      confirmLabel="Confirmar cancelamento"
      pendingLabel="Cancelando…"
    >
      <input type="hidden" name="requestId" value={requestId} />
    </ConfirmAction>
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
            className="btn btn-admin-primary btn-md"
          />
        )}
        {canAttend && (
          <ActionButton
            requestId={requestId}
            label="Marcar como atendido"
            pendingLabel="Marcando…"
            successMessage="Atendimento registrado."
            action={markAppointmentAttended}
            className="btn btn-admin-primary btn-md"
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
