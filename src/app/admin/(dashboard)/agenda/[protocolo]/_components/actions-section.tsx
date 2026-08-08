"use client";

import { useActionState } from "react";
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
  action,
  className,
}: {
  requestId: string;
  label: string;
  pendingLabel: string;
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
  className: string;
}) {
  const [state, boundAction, pending] = useActionState<ActionState, FormData>(
    action,
    { status: "idle" },
  );
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

export function ActionsSection({
  requestId,
  status,
  days,
}: {
  requestId: string;
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
            action={confirmAppointment}
            className="rounded-[9px] bg-admin-primary-soft px-4.5 py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
          />
        )}
        {canAttend && (
          <ActionButton
            requestId={requestId}
            label="Marcar como atendido"
            pendingLabel="Salvando…"
            action={markAppointmentAttended}
            className="rounded-[9px] bg-admin-primary-soft px-4.5 py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
          />
        )}
        {canAct && <ProposeSlotPicker requestId={requestId} days={days} />}
        <ActionButton
          requestId={requestId}
          label="Cancelar pedido"
          pendingLabel="Cancelando…"
          action={cancelAppointment}
          className="rounded-[9px] border border-admin-error-border px-4 py-2.5 text-[12.5px] font-bold text-admin-error-text disabled:opacity-60"
        />
      </div>
      <p className="mt-2.5 text-[11.5px] text-admin-faint">
        Confirmar avisa o cidadão pelo contato informado. Propor outro horário
        mostra a mesma faixa livre do formulário público, para o cidadão
        escolher pela consulta de protocolo.
      </p>
    </div>
  );
}
