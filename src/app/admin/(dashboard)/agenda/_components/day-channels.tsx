"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ATTENDANCE_CHANNELS,
  type AttendanceChannel,
  CHANNEL_NAMES,
} from "@/core/scheduling/agenda.ts";
import { type ActionState, saveDayChannels } from "../actions.ts";

/**
 * "Como o tabelião atende neste dia": the channels of one date, which start
 * as the weekday's and can be changed for this date only. The citizen sees
 * the choice on the site as soon as it is saved.
 */
export function DayChannelsCard({
  date,
  dateLabel,
  channels,
  own,
  weekdayChannels,
}: {
  date: string;
  dateLabel: string;
  /** What the date offers now. */
  channels: AttendanceChannel[];
  /** Whether the date has its own choice, instead of the weekday's. */
  own: boolean;
  /** The weekday's channels, for the "voltar ao padrão" line. */
  weekdayChannels: AttendanceChannel[];
}) {
  const [picked, setPicked] = useState<AttendanceChannel[]>(channels);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveDayChannels,
    { status: "idle" },
  );

  // A new date, or the saved state coming back from the server, resets the
  // ticks to what the date really offers.
  const key = `${date}|${channels.join(",")}`;
  const lastKey = useRef(key);
  useEffect(() => {
    if (lastKey.current === key) return;
    lastKey.current = key;
    setPicked(channels);
  }, [key, channels]);

  const lastState = useRef(state);
  useEffect(() => {
    if (state === lastState.current) return;
    lastState.current = state;
    if (state.status === "success") toast.success(state.message ?? "Salvo.");
  }, [state]);

  const changed =
    [...picked].sort().join(",") !== [...channels].sort().join(",");
  const names = (list: AttendanceChannel[]) =>
    list
      .map((channel) => CHANNEL_NAMES[channel].label.toLowerCase())
      .join(", ");

  return (
    <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
      <h3 className="text-[13px] font-bold text-admin-primary">
        Como o tabelião atende em {dateLabel}
      </h3>
      <p className="mt-1 text-[12.5px] leading-relaxed text-admin-muted">
        {own
          ? `Escolha só deste dia. O padrão da semana é ${names(weekdayChannels)}.`
          : "Segue o padrão do dia da semana. Mude aqui para valer só nesta data."}
      </p>
      <form action={formAction} className="mt-3 flex flex-col gap-2">
        <input type="hidden" name="date" value={date} />
        {ATTENDANCE_CHANNELS.map((channel) => (
          <label
            key={channel}
            className="flex cursor-pointer items-start gap-2 text-[12.5px] text-admin-text"
          >
            <input
              type="checkbox"
              name="channels"
              value={channel}
              className="checkbox-admin mt-0.5"
              checked={picked.includes(channel)}
              onChange={() =>
                setPicked(
                  picked.includes(channel)
                    ? picked.filter((item) => item !== channel)
                    : [...picked, channel],
                )
              }
            />
            <span>
              <span className="font-semibold">
                {CHANNEL_NAMES[channel].label}
              </span>
              <span className="block text-[11.5px] text-admin-muted">
                {CHANNEL_NAMES[channel].description}
              </span>
            </span>
          </label>
        ))}
        {state.status === "error" && (
          <p
            role="alert"
            className="text-[12px] font-semibold text-admin-alert"
          >
            {state.message}
          </p>
        )}
        <div className="mt-1 flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending || !changed || picked.length === 0}
            className="rounded-lg bg-admin-primary px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Salvando..." : "Salvar para este dia"}
          </button>
          {own && (
            <button
              type="submit"
              name="restore"
              value="1"
              disabled={pending}
              className="rounded-lg border border-admin-border px-3 py-2 text-[12.5px] font-semibold text-admin-muted hover:bg-admin-input-bg"
            >
              Voltar ao padrão da semana
            </button>
          )}
        </div>
        <p className="text-[11.5px] leading-relaxed text-admin-faint">
          Agendamentos já feitos continuam como foram marcados.
        </p>
      </form>
    </section>
  );
}
