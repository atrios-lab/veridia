"use client";

import { useMemo, useState } from "react";
import {
  isQuickService,
  type Suggestion,
  suggestGrid,
  usualMinutes,
} from "@/core/scheduling/suggest.ts";

const cardClass =
  "rounded-[14px] border border-admin-border bg-admin-card px-5 py-4";
const inputClass =
  "rounded-lg border border-admin-border bg-admin-input-bg px-2.5 py-1.5 text-[13px] text-admin-text outline-none focus:border-admin-accent";

interface ServiceRow {
  id: string;
  label: string;
  minutes: number;
  quick: boolean;
  included: boolean;
}

/**
 * "Montar a grade automaticamente": the office says how many people attend,
 * the hours, the lunch in turns and how long each service takes; the card
 * shows the day of each attendant and, on "Usar esta grade", writes the
 * times, the vacancies and the services of each time into the days ticked.
 * Nothing is saved until the office saves the agenda.
 */
export function SuggestCard({
  services,
  weekdays,
  onApply,
}: {
  /** The services this agenda takes. */
  services: Array<{ id: string; label: string }>;
  weekdays: Array<{ day: string; label: string }>;
  onApply: (days: string[], suggestion: Suggestion) => void;
}) {
  const [open, setOpen] = useState(false);
  const [openAt, setOpenAt] = useState("08:00");
  const [closeAt, setCloseAt] = useState("14:00");
  const [staff, setStaff] = useState(2);
  const [lunchOn, setLunchOn] = useState(true);
  const [lunchFrom, setLunchFrom] = useState("12:00");
  const [lunchTo, setLunchTo] = useState("14:00");
  const [lunchMinutes, setLunchMinutes] = useState(60);
  const [days, setDays] = useState<string[]>(weekdays.map((w) => w.day));
  const [rows, setRows] = useState<ServiceRow[]>(() =>
    services.map((service) => ({
      ...service,
      minutes: usualMinutes(service.label),
      quick: isQuickService(service.label),
      included: true,
    })),
  );

  const suggestion = useMemo(
    () =>
      suggestGrid({
        open: openAt,
        close: closeAt,
        staff,
        lunch: lunchOn
          ? { from: lunchFrom, to: lunchTo, minutes: lunchMinutes }
          : undefined,
        quick: rows
          .filter((row) => row.included && row.quick)
          .map(({ id, minutes }) => ({ id, minutes })),
        long: rows
          .filter((row) => row.included && !row.quick)
          .map(({ id, minutes }) => ({ id, minutes })),
      }),
    [openAt, closeAt, staff, lunchOn, lunchFrom, lunchTo, lunchMinutes, rows],
  );
  const labelOf = new Map(services.map((s) => [s.id, s.label]));
  const total = Object.values(suggestion.capacity).reduce((a, b) => a + b, 0);

  function update(id: string, patch: Partial<ServiceRow>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  if (!open) {
    return (
      <section
        className={`${cardClass} flex flex-wrap items-center justify-between gap-3`}
      >
        <div>
          <h2 className="font-serif text-[16px] font-semibold text-admin-primary">
            Montar a grade automaticamente
          </h2>
          <p className="mt-1 text-[12.5px] text-admin-muted">
            Diga quantas pessoas atendem, o horário, o almoço e quanto tempo
            leva cada serviço: o sistema monta os horários, as vagas e intercala
            os serviços rápidos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={services.length === 0}
          className="rounded-lg bg-admin-primary px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"
        >
          Sugerir horários
        </button>
      </section>
    );
  }

  return (
    <section className={cardClass}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-[16px] font-semibold text-admin-primary">
          Montar a grade automaticamente
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[12px] font-semibold text-admin-muted underline"
        >
          Fechar
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-admin-muted">
          Abre às
          <input
            type="time"
            value={openAt}
            onChange={(e) => setOpenAt(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-admin-muted">
          Último atendimento termina às
          <input
            type="time"
            value={closeAt}
            onChange={(e) => setCloseAt(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-admin-muted">
          Pessoas atendendo
          <input
            type="number"
            min={1}
            max={99}
            value={staff}
            onChange={(e) => setStaff(Number(e.target.value) || 1)}
            className={`${inputClass} tabular-nums`}
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-admin-text">
        <label className="flex items-center gap-2 font-semibold">
          <input
            type="checkbox"
            checked={lunchOn}
            onChange={(e) => setLunchOn(e.target.checked)}
            className="h-4 w-4 accent-admin-primary"
          />
          Almoço em turnos, sem fechar o atendimento:
        </label>
        <span className="flex flex-wrap items-center gap-1.5 text-admin-muted">
          entre
          <input
            type="time"
            value={lunchFrom}
            onChange={(e) => setLunchFrom(e.target.value)}
            disabled={!lunchOn}
            className={inputClass}
          />
          e
          <input
            type="time"
            value={lunchTo}
            onChange={(e) => setLunchTo(e.target.value)}
            disabled={!lunchOn}
            className={inputClass}
          />
          , cada pessoa
          <input
            type="number"
            min={15}
            step={15}
            value={lunchMinutes}
            onChange={(e) => setLunchMinutes(Number(e.target.value) || 60)}
            disabled={!lunchOn}
            className={`${inputClass} w-16 tabular-nums`}
          />
          min
        </span>
      </div>

      <div className="mt-4">
        <h3 className="text-[13px] font-bold text-admin-primary">
          Serviços e tempo de cada um
        </h3>
        <p className="mt-0.5 text-[12px] text-admin-muted">
          Os marcados como rápidos entram entre os outros, para sempre haver uma
          vaga rápida perto. Desmarque o que não entra na grade.
        </p>
        <ul className="mt-2 grid gap-1.5">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center gap-2 text-[12.5px]"
            >
              <input
                type="checkbox"
                checked={row.included}
                onChange={(e) => update(row.id, { included: e.target.checked })}
                aria-label={`Incluir ${row.label}`}
                className="h-4 w-4 accent-admin-primary"
              />
              <span className="min-w-0 flex-1 truncate text-admin-text">
                {row.label}
              </span>
              <input
                type="number"
                min={10}
                step={5}
                value={row.minutes}
                onChange={(e) =>
                  update(row.id, { minutes: Number(e.target.value) || 30 })
                }
                aria-label={`Minutos de ${row.label}`}
                className={`${inputClass} w-16 tabular-nums`}
              />
              <span className="text-admin-muted">min</span>
              <label className="flex items-center gap-1 text-admin-muted">
                <input
                  type="checkbox"
                  checked={row.quick}
                  onChange={(e) => update(row.id, { quick: e.target.checked })}
                  className="h-3.5 w-3.5 accent-admin-primary"
                />
                rápido
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 rounded-lg bg-admin-input-bg px-3 py-2.5">
        <p className="text-[12.5px] font-semibold text-admin-primary">
          {total} atendimentos por dia, em {suggestion.times.length} horários
        </p>
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {suggestion.times.map((time) => (
            <li
              key={time}
              className="rounded-md bg-admin-card px-2 py-1 text-[11.5px] tabular-nums text-admin-text"
              title={suggestion.services[time]
                .map((id) => labelOf.get(id) ?? id)
                .join(", ")}
            >
              <strong>{time}</strong>
              {suggestion.capacity[time] > 1 &&
                ` · ${suggestion.capacity[time]} vagas`}
            </li>
          ))}
        </ul>
        <details className="mt-2">
          <summary className="cursor-pointer text-[12px] font-semibold text-admin-accent">
            Ver o dia de cada pessoa
          </summary>
          <ol className="mt-1.5 flex flex-col gap-1">
            {suggestion.lanes.map((lane, index) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: one lane per attendant, by position.
                key={index}
                className="text-[11.5px] leading-relaxed text-admin-muted"
              >
                <strong className="text-admin-text">Pessoa {index + 1}:</strong>{" "}
                {lane
                  .map(
                    (block) =>
                      `${block.start} ${
                        block.kind === "lunch"
                          ? "almoço"
                          : block.kind === "quick"
                            ? "rápido"
                            : (labelOf.get(block.serviceIds[0]) ?? "")
                      }`,
                  )
                  .join(" · ")}
              </li>
            ))}
          </ol>
        </details>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px]">
        <span className="font-semibold text-admin-text">Usar em:</span>
        {weekdays.map(({ day, label }) => (
          <label key={day} className="flex items-center gap-1 text-admin-muted">
            <input
              type="checkbox"
              checked={days.includes(day)}
              onChange={(e) =>
                setDays((current) =>
                  e.target.checked
                    ? [...current, day]
                    : current.filter((d) => d !== day),
                )
              }
              className="h-3.5 w-3.5 accent-admin-primary"
            />
            {label}
          </label>
        ))}
        <button
          type="button"
          disabled={days.length === 0 || suggestion.times.length === 0}
          onClick={() => {
            onApply(days, suggestion);
            setOpen(false);
          }}
          className="ml-auto rounded-lg bg-admin-primary px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"
        >
          Usar esta grade
        </button>
      </div>
      <p className="mt-2 text-[11.5px] text-admin-faint">
        A grade dos dias marcados é trocada pela sugestão. Confira abaixo e
        clique em Salvar agendas: nada muda no site antes disso.
      </p>
    </section>
  );
}
