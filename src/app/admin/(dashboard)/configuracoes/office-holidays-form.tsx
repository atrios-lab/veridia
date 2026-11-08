"use client";

import { useActionState, useRef, useState } from "react";
import {
  type CustomHoliday,
  formatDate,
  type LawHoliday,
  longWeekday,
  type OfficeHolidays,
} from "@/core/scheduling/calendar.ts";
import { MAX_CUSTOM_HOLIDAYS } from "@/core/tenant/schema.ts";
import { AdminIcon } from "../../_components/icon.tsx";
import { type OfficeHolidaysState, saveOfficeHolidays } from "./actions.ts";

const FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";
const ERROR_FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-error-border bg-admin-error-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-error-text";

/**
 * Names an office reaches for most, offered as one-click starts. Only the
 * name is filled: the date is each town's own, and guessing it would close
 * the counter on the wrong day.
 */
const SUGGESTIONS = [
  "Padroeiro(a) do município",
  "Aniversário do município",
  "Dia do Evangélico",
];

type Row = CustomHoliday & { key: number };

export function OfficeHolidaysForm({
  initial,
  law,
}: {
  initial: OfficeHolidays;
  /** The national and state days off ahead, kept or switched off. */
  law: readonly LawHoliday[];
}) {
  const [state, formAction, pending] = useActionState<
    OfficeHolidaysState,
    FormData
  >(saveOfficeHolidays, { status: "idle" });
  const own = initial.customHolidays ?? [];
  const nextKey = useRef(own.length);
  const [rows, setRows] = useState<Row[]>(() =>
    own.map((holiday, key) => ({ ...holiday, key })),
  );
  const [disabled, setDisabled] = useState<ReadonlySet<string>>(
    () => new Set(initial.disabledHolidays ?? []),
  );
  const keptCount = law.filter((day) => !disabled.has(day.id)).length;
  const fieldErrors = state.status === "error" ? state.fieldErrors : {};
  const full = rows.length >= MAX_CUSTOM_HOLIDAYS;

  function add(name = "") {
    if (full) return;
    setRows((current) => [
      ...current,
      { key: nextKey.current++, name, date: "", yearly: true },
    ]);
  }

  function update(key: number, patch: Partial<CustomHoliday>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function remove(key: number) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  function setKept(id: string, kept: boolean) {
    setDisabled((current) => {
      const next = new Set(current);
      if (kept) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /**
   * "Alterar" a law day: it stops counting by the law's date and comes down
   * to the office's own list with its name and date, ready to edit. Yearly
   * for a fixed date; a day that follows Easter moves every year, so it
   * comes down as that year's date alone.
   */
  function takeOver(day: LawHoliday) {
    if (full) return;
    setKept(day.id, false);
    setRows((current) => [
      ...current,
      {
        key: nextKey.current++,
        name: day.name,
        date: day.date,
        yearly: !day.movable,
      },
    ]);
  }

  const payload = JSON.stringify({
    customHolidays: rows.map(({ name, date, yearly }) => ({
      name,
      date,
      yearly,
    })),
    disabledHolidays: [...disabled],
  });

  return (
    <form action={formAction}>
      <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
        Feriados e dias sem expediente
      </h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-admin-muted">
        Os feriados nacionais e os dias do Código de Normas do RN já entram
        sozinhos, e você pode desligar ou alterar algum que não valha aqui.
        Cadastre aqui os do município e outros dias em que a serventia fecha.
        Nesses dias o site avisa que é feriado, o chat não abre, a agenda não
        oferece horário e os prazos não correm.
      </p>

      <details className="mt-3.5 rounded-[10px] border border-admin-border bg-admin-input-bg px-3.5 py-2.5">
        <summary className="cursor-pointer text-[12.5px] font-semibold text-admin-primary">
          Ver e ajustar os {keptCount} dias já considerados nos próximos 12
          meses
        </summary>
        <p className="mt-2 text-[11.5px] leading-relaxed text-admin-muted">
          Algum não vale na sua localidade, ou cai em outra data? Use "Não fecha
          aqui" para desligar, ou "Alterar" para trazer para a lista da
          serventia e mudar nome e data. Vale para todos os anos, e "Voltar a
          considerar" desfaz.
        </p>
        <ul className="mt-2.5 flex flex-col divide-y divide-admin-border text-[12.5px] text-admin-text">
          {law.map((day) => {
            const kept = !disabled.has(day.id);
            return (
              <li
                key={`${day.id}-${day.date}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5"
              >
                <span
                  className={`flex-1 ${kept ? "" : "line-through opacity-60"}`}
                >
                  <span className="font-semibold">{formatDate(day.date)}</span>{" "}
                  <span className="text-admin-muted">
                    ({longWeekday(day.date)})
                  </span>{" "}
                  {day.name}
                </span>
                {kept ? (
                  <span className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => takeOver(day)}
                      disabled={full}
                      className="btn btn-admin-ghost btn-sm"
                      aria-label={`Alterar ${day.name}`}
                    >
                      Alterar
                    </button>
                    <button
                      type="button"
                      onClick={() => setKept(day.id, false)}
                      className="btn btn-admin-ghost btn-sm"
                      aria-label={`${day.name}: não fecha aqui`}
                    >
                      Não fecha aqui
                    </button>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span className="rounded-full bg-admin-warning-bg px-2.5 py-0.5 text-[11px] font-bold text-admin-warning-text">
                      Não fecha aqui
                    </span>
                    <button
                      type="button"
                      onClick={() => setKept(day.id, true)}
                      className="btn btn-admin-ghost btn-sm"
                      aria-label={`Voltar a considerar ${day.name}`}
                    >
                      Voltar a considerar
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </details>

      <h3 className="mt-5 mb-2.5 text-[11.5px] font-bold uppercase tracking-[0.09em] text-admin-accent">
        Feriados da serventia
      </h3>

      {rows.length === 0 && (
        <p className="text-[12.5px] text-admin-muted">
          Nenhum feriado próprio cadastrado.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {rows.map((row, index) => {
          const nameError = fieldErrors[`${index}.name`];
          const dateError = fieldErrors[`${index}.date`];
          const nameId = `feriado-${row.key}-nome`;
          const dateId = `feriado-${row.key}-data`;
          return (
            <li
              key={row.key}
              className="grid grid-cols-1 items-start gap-2.5 rounded-[10px] border border-admin-border p-3 md:grid-cols-[1fr_180px_auto_auto]"
            >
              <div>
                <label
                  htmlFor={nameId}
                  className="mb-1 block text-xs font-bold text-admin-primary"
                >
                  Nome
                </label>
                <input
                  id={nameId}
                  value={row.name}
                  onChange={(event) =>
                    update(row.key, { name: event.target.value })
                  }
                  placeholder="Ex.: São Sebastião, padroeiro"
                  maxLength={80}
                  aria-invalid={nameError ? true : undefined}
                  aria-describedby={nameError ? `${nameId}-erro` : undefined}
                  className={nameError ? ERROR_FIELD_CLASS : FIELD_CLASS}
                />
                {nameError && (
                  <p
                    id={`${nameId}-erro`}
                    className="mt-1 text-xs font-semibold text-admin-error-text"
                  >
                    {nameError}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor={dateId}
                  className="mb-1 block text-xs font-bold text-admin-primary"
                >
                  Data
                </label>
                <input
                  id={dateId}
                  type="date"
                  value={row.date}
                  onChange={(event) =>
                    update(row.key, { date: event.target.value })
                  }
                  aria-invalid={dateError ? true : undefined}
                  aria-describedby={dateError ? `${dateId}-erro` : undefined}
                  className={dateError ? ERROR_FIELD_CLASS : FIELD_CLASS}
                />
                {dateError && (
                  <p
                    id={`${dateId}-erro`}
                    className="mt-1 text-xs font-semibold text-admin-error-text"
                  >
                    {dateError}
                  </p>
                )}
              </div>
              <label className="flex items-center gap-2 text-[12.5px] text-admin-text md:mt-7">
                <input
                  type="checkbox"
                  className="checkbox-admin"
                  checked={row.yearly}
                  onChange={(event) =>
                    update(row.key, { yearly: event.target.checked })
                  }
                />
                Todo ano
              </label>
              <button
                type="button"
                onClick={() => remove(row.key)}
                className="btn btn-admin-ghost btn-sm md:mt-6"
                aria-label={`Remover ${row.name || "este feriado"}`}
              >
                Remover
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => add()}
          disabled={full}
          className="btn btn-admin-secondary btn-md"
        >
          Adicionar feriado
        </button>
        {SUGGESTIONS.filter(
          (name) => !rows.some((row) => row.name === name),
        ).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => add(name)}
            disabled={full}
            className="btn btn-admin-ghost btn-sm"
          >
            + {name}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11.5px] text-admin-muted">
        "Todo ano" repete no mesmo dia e mês. Desmarque para um dia que só vale
        naquele ano, como um ponto facultativo decretado.
      </p>

      <input type="hidden" name="holidays" value={payload} />

      {state.status === "error" && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-admin-error-bg px-3.5 py-2.5 text-sm font-semibold text-admin-error-text"
        >
          {state.message}
        </p>
      )}

      <div className="mt-4.5 flex items-center gap-3.5">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-admin-primary btn-lg"
        >
          {pending ? "Salvando…" : "Salvar feriados"}
        </button>
        {state.status === "saved" && (
          <output className="flex items-center gap-1.5 rounded-full bg-admin-success-bg px-3 py-1.5 text-[12.5px] font-semibold text-admin-success-text">
            <AdminIcon name="check" className="h-3.5 w-3.5" strokeWidth={2.4} />
            Salvo. Já está valendo no site.
          </output>
        )}
      </div>
    </form>
  );
}
