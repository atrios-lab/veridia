"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { ClosedDate } from "@/core/scheduling/agenda.ts";
import { formatShortDate } from "@/core/scheduling/calendar.ts";
import { type ActionState, saveAgenda } from "../actions.ts";

const inputClass =
  "w-full rounded-lg border border-admin-border bg-admin-input-bg px-3 py-2 text-[13px] text-admin-text outline-none focus:border-admin-accent";

/**
 * The whole agenda in one form. Free text lists, not a widget per time: the
 * office writes "08:30, 09:00, 09:30" the way it would on paper, and the core's
 * schema is what refuses anything that is not a time.
 */
export function AgendaSettingsForm({
  grid,
  weekdays,
  services,
  modes,
  closedDates,
}: {
  grid: Record<string, string>;
  weekdays: Array<{ day: number; label: string }>;
  services: string;
  modes: string;
  closedDates: ClosedDate[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveAgenda,
    { status: "idle" },
  );

  return (
    <form action={formAction} className="flex flex-col gap-4.5">
      <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
        <h2 className="text-[13.5px] font-bold text-admin-primary">
          Horários por dia da semana
        </h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-admin-muted">
          Escreva as horas de início separadas por vírgula, no formato HH:mm.
          Cada horário atende <strong>um cidadão</strong>. Um dia sem horários
          não aparece no site.
        </p>

        <div className="mt-3.5 flex flex-col gap-2.5">
          {weekdays.map(({ day, label }) => (
            <div
              key={day}
              className="grid grid-cols-[110px_1fr] items-center gap-3"
            >
              <label
                htmlFor={`grid-${day}`}
                className="text-[13px] font-semibold text-admin-text"
              >
                {label}
              </label>
              <input
                id={`grid-${day}`}
                name={`grid.${day}`}
                defaultValue={grid[String(day)] ?? ""}
                placeholder="08:30, 09:00, 09:30"
                className={inputClass}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
        <h2 className="text-[13.5px] font-bold text-admin-primary">
          Serviços que o cidadão pode escolher
        </h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-admin-muted">
          Um por linha. Inclua "Tabelião" para o que só o tabelião resolve.
        </p>
        <textarea
          name="services"
          rows={8}
          defaultValue={services}
          placeholder={
            "Registro de recém-nascido\nHabilitação para casamento\n2ª via de certidão\nReconhecimento de firma\nProcuração\nEscritura\nTabelião"
          }
          className={`${inputClass} mt-3`}
        />
      </section>

      <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
        <h2 className="text-[13.5px] font-bold text-admin-primary">
          Modos de atendimento
        </h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-admin-muted">
          Um por linha. Só coloque o que a serventia realmente oferece.
        </p>
        <textarea
          name="modes"
          rows={5}
          defaultValue={modes}
          placeholder={"Presencial\nOn-line\nDiligência\nDrive-thru"}
          className={`${inputClass} mt-3`}
        />
      </section>

      {closedDates.length > 0 && (
        <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <h2 className="text-[13.5px] font-bold text-admin-primary">
            Dias fechados
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-admin-muted">
            Fechados a partir da própria agenda do dia. Para reabrir, abra a
            data e use "Reabrir o dia".
          </p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {closedDates.map((closed) => (
              <li
                key={closed.date}
                className="flex items-baseline gap-2 text-[12.5px]"
              >
                <Link
                  href={`/admin/agenda?dia=${closed.date}`}
                  className="font-semibold text-admin-accent underline"
                >
                  {formatShortDate(closed.date)}
                </Link>
                <span className="text-admin-muted">{closed.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-lg border border-admin-alert px-3.5 py-2.5 text-[13px] font-semibold text-admin-alert"
        >
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p className="rounded-lg bg-admin-success-bg px-3.5 py-2.5 text-[13px] font-semibold text-admin-success-text">
          {state.message ?? "Agenda salva."}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-admin-primary px-5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Salvando..." : "Salvar agenda"}
        </button>
      </div>
    </form>
  );
}
