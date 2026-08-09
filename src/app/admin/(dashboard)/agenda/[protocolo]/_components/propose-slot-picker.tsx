"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import type { IsoDate } from "@/core/scheduling/calendar.ts";
import type { Slot } from "@/core/scheduling/slots.ts";
import { type ActionState, proposeOtherSlot } from "../actions.ts";

export interface DayOption {
  date: IsoDate;
  shortLabel: string;
  bands: Slot[];
}

/**
 * The same bands the public scheduling form offers, picked from the same
 * `appointmentOccupancy` the server already computed — this only switches
 * which precomputed day is on screen, no extra round trip.
 */
export function ProposeSlotPicker({
  requestId,
  days,
}: {
  requestId: string;
  days: DayOption[];
}) {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(days[0]?.date);
  const [selectedHour, setSelectedHour] = useState<number | undefined>();
  const [state, action, pending] = useActionState<ActionState, FormData>(
    proposeOtherSlot,
    { status: "idle" },
  );

  const selectedDay = days.find((d) => d.date === selectedDate);

  /* On success the panel closes and the selection resets — leaving it open
   * with no feedback is what invited double proposals. */
  useEffect(() => {
    if (state.status === "success") {
      toast.success(
        "Proposta enviada. O cidadão escolhe pela consulta de protocolo.",
      );
      setOpen(false);
      setSelectedHour(undefined);
    }
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[9px] border border-admin-input-border px-4 py-2.5 text-[12.5px] font-bold text-admin-muted"
      >
        Propor outro horário
      </button>
    );
  }

  return (
    <div className="mt-3.5 rounded-[11px] border border-admin-border bg-admin-input-bg p-4">
      <span className="mb-2 block text-[12.5px] font-bold text-admin-primary">
        Dia
      </span>
      <ul className="flex gap-1.5 overflow-x-auto pb-1">
        {days.map((day) => (
          <li key={day.date} className="shrink-0">
            <button
              type="button"
              onClick={() => {
                setSelectedDate(day.date);
                setSelectedHour(undefined);
              }}
              aria-current={day.date === selectedDate ? "date" : undefined}
              className={`rounded-[9px] border px-3 py-1.5 text-[12px] font-semibold ${
                day.date === selectedDate
                  ? "border-admin-primary bg-admin-primary text-white"
                  : "border-admin-input-border bg-admin-card text-admin-text"
              }`}
            >
              {day.shortLabel}
            </button>
          </li>
        ))}
      </ul>

      <span className="mt-3.5 mb-2 block text-[12.5px] font-bold text-admin-primary">
        Faixa livre
      </span>
      {(selectedDay?.bands ?? []).length === 0 ? (
        <p className="text-[12px] text-admin-muted">
          Sem faixas livres neste dia. Escolha outro dia.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {(selectedDay?.bands ?? []).map((slot) => (
            <button
              key={slot.hour}
              type="button"
              disabled={slot.state === "taken"}
              title={slot.state === "taken" ? "Ocupado" : undefined}
              aria-label={
                slot.state === "taken" ? `${slot.label} — ocupado` : undefined
              }
              onClick={() => setSelectedHour(slot.hour)}
              className={`rounded-[9px] border px-3 py-1.5 text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                selectedHour === slot.hour
                  ? "border-admin-primary bg-admin-primary text-white"
                  : "border-admin-input-border bg-admin-card text-admin-text"
              }`}
            >
              {slot.label}
            </button>
          ))}
        </div>
      )}

      <form action={action} className="mt-3.5 flex items-center gap-2.5">
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="date" value={selectedDate ?? ""} />
        <input type="hidden" name="slotHour" value={selectedHour ?? ""} />
        <button
          type="submit"
          disabled={pending || selectedHour === undefined}
          className="rounded-[9px] bg-admin-primary-soft px-4 py-2.5 text-[12.5px] font-bold text-white disabled:opacity-60"
        >
          {pending ? "Enviando…" : "Propor este horário"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[12px] font-semibold text-admin-muted"
        >
          Fechar
        </button>
      </form>

      {state.status === "error" && (
        <p
          role="alert"
          className="mt-2 text-[12.5px] font-semibold text-admin-error-text"
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
