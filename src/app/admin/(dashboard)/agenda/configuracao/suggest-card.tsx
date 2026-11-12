"use client";

import { useId, useMemo, useState } from "react";
import {
  isQuickService,
  type Suggestion,
  suggestGrid,
  usualMinutes,
} from "@/core/scheduling/suggest.ts";
import { Button } from "../../../_ui/button.tsx";
import { cn } from "../../../_ui/cn.ts";
import { Input } from "../../../_ui/input.tsx";

const cardClass = "rounded-xl border bg-card px-5 py-4";
/** The fields sit inline in sentences: sized by content, not full width. */
const inputClass = "h-8 w-auto bg-background tabular-nums";

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
  starting = false,
}: {
  /** The services this agenda takes (or, starting, the ones suggested). */
  services: Array<{ id: string; label: string }>;
  weekdays: Array<{ day: string; label: string }>;
  /** The days, the grid, and the services kept ticked in the card. */
  onApply: (
    days: string[],
    suggestion: Suggestion,
    serviceIds: string[],
  ) => void;
  /**
   * The agenda has no service ticked yet (a new office): the card offers
   * the suggested ones, and using the grid ticks them in the agenda
   * (decision of 11/11/2026). Before, the button stayed disabled.
   */
  starting?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const fieldId = useId();
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
          <h2 className="text-base font-semibold text-foreground">
            Montar a grade automaticamente
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Diga quantas pessoas atendem, o horário, o almoço e quanto tempo
            leva cada serviço: o sistema monta os horários, as vagas e intercala
            os serviços rápidos.
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          Sugerir horários
        </Button>
      </section>
    );
  }

  return (
    <section className={cardClass}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">
          Montar a grade automaticamente
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-medium text-muted-foreground underline hover:text-foreground"
        >
          Fechar
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label
          htmlFor={`${fieldId}-open`}
          className="flex flex-col gap-1 text-xs font-medium text-muted-foreground"
        >
          Abre às
          <Input
            id={`${fieldId}-open`}
            type="time"
            value={openAt}
            onChange={(e) => setOpenAt(e.target.value)}
            className={inputClass}
          />
        </label>
        <label
          htmlFor={`${fieldId}-close`}
          className="flex flex-col gap-1 text-xs font-medium text-muted-foreground"
        >
          Último atendimento termina às
          <Input
            id={`${fieldId}-close`}
            type="time"
            value={closeAt}
            onChange={(e) => setCloseAt(e.target.value)}
            className={inputClass}
          />
        </label>
        <label
          htmlFor={`${fieldId}-staff`}
          className="flex flex-col gap-1 text-xs font-medium text-muted-foreground"
        >
          Pessoas atendendo
          <Input
            id={`${fieldId}-staff`}
            type="number"
            min={1}
            max={99}
            value={staff}
            onChange={(e) => setStaff(Number(e.target.value) || 1)}
            className={inputClass}
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-foreground">
        <label className="flex items-center gap-2 font-medium">
          <input
            type="checkbox"
            checked={lunchOn}
            onChange={(e) => setLunchOn(e.target.checked)}
            className="checkbox-admin"
          />
          Almoço em turnos, sem fechar o atendimento:
        </label>
        <span className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
          entre
          <Input
            type="time"
            value={lunchFrom}
            onChange={(e) => setLunchFrom(e.target.value)}
            disabled={!lunchOn}
            className={inputClass}
          />
          e
          <Input
            type="time"
            value={lunchTo}
            onChange={(e) => setLunchTo(e.target.value)}
            disabled={!lunchOn}
            className={inputClass}
          />
          , cada pessoa
          <Input
            type="number"
            min={15}
            step={15}
            value={lunchMinutes}
            onChange={(e) => setLunchMinutes(Number(e.target.value) || 60)}
            disabled={!lunchOn}
            className={cn(inputClass, "w-16")}
          />
          min
        </span>
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-foreground">
          Serviços e tempo de cada um
        </h3>
        {starting && (
          <p className="mt-1 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning-text">
            Esta agenda ainda não tem serviços marcados. Estes são os sugeridos
            para ela: desmarque os que a serventia não atende. Ao usar a grade,
            os marcados passam a ser os serviços da agenda (dá para mudar
            depois, mais abaixo).
          </p>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground">
          Os marcados como rápidos entram entre os outros, para sempre haver uma
          vaga rápida perto. Desmarque o que não entra na grade.
        </p>
        <ul className="mt-2 grid gap-1.5">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center gap-2 text-xs"
            >
              <input
                type="checkbox"
                checked={row.included}
                onChange={(e) => update(row.id, { included: e.target.checked })}
                aria-label={`Incluir ${row.label}`}
                className="checkbox-admin"
              />
              <span className="min-w-0 flex-1 truncate text-foreground">
                {row.label}
              </span>
              <Input
                type="number"
                min={10}
                step={5}
                value={row.minutes}
                onChange={(e) =>
                  update(row.id, { minutes: Number(e.target.value) || 30 })
                }
                aria-label={`Minutos de ${row.label}`}
                className={cn(inputClass, "w-16")}
              />
              <span className="text-muted-foreground">min</span>
              <label className="flex items-center gap-1 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={row.quick}
                  onChange={(e) => update(row.id, { quick: e.target.checked })}
                  className="checkbox-admin"
                />
                rápido
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 rounded-lg bg-muted/50 px-3 py-2.5">
        <p className="text-xs font-semibold text-foreground">
          {total} atendimentos por dia, em {suggestion.times.length} horários
        </p>
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {suggestion.times.map((time) => (
            <li
              key={time}
              className="rounded-md border bg-background px-2 py-1 text-xs tabular-nums text-foreground"
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
          <summary className="cursor-pointer text-xs font-medium text-primary">
            Ver o dia de cada pessoa
          </summary>
          <ol className="mt-1.5 flex flex-col gap-1">
            {suggestion.lanes.map((lane, index) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: one lane per attendant, by position.
                key={index}
                className="text-xs leading-relaxed text-muted-foreground"
              >
                <strong className="font-semibold text-foreground">
                  Pessoa {index + 1}:
                </strong>{" "}
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

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-foreground">Usar em:</span>
        {weekdays.map(({ day, label }) => (
          <label
            key={day}
            className="flex items-center gap-1 text-muted-foreground"
          >
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
              className="checkbox-admin"
            />
            {label}
          </label>
        ))}
        <Button
          type="button"
          size="sm"
          disabled={days.length === 0 || suggestion.times.length === 0}
          onClick={() => {
            onApply(
              days,
              suggestion,
              rows.filter((row) => row.included).map((row) => row.id),
            );
            setOpen(false);
          }}
          className="ml-auto"
        >
          Usar esta grade
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        A grade dos dias marcados é trocada pela sugestão. Confira abaixo e
        clique em Salvar agendas: nada muda no site antes disso.
      </p>
    </section>
  );
}
