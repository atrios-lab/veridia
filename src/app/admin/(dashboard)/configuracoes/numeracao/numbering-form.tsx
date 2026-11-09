"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import type { NumberSeries } from "@/core/numbering/series.ts";
import { type NumberingState, saveNumbering } from "./actions.ts";

const FIELD =
  "rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3 py-2 text-[13px] text-admin-text outline-none focus:border-admin-primary-soft";
const LABEL = "mb-1 block text-xs font-bold text-admin-primary";

/** The year and the next number of one series, saved on their own. */
export function NumberingForm({
  series,
  years,
}: {
  series: NumberSeries;
  years: { year: number; next: number }[];
}) {
  const [state, action, pending] = useActionState<NumberingState, FormData>(
    saveNumbering,
    { status: "idle" },
  );
  const [year, setYear] = useState(years[0]?.year ?? 0);
  const [next, setNext] = useState(String(years[0]?.next ?? 1));

  useEffect(() => {
    if (state.status === "saved") toast.success(state.message);
  }, [state]);

  const id = `numeracao-${series}`;
  return (
    <form
      // Not `action={action}`: React resets a form after its action, and these
      // fields are controlled; the reset would show the first values again.
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
      className="mt-3 flex flex-wrap items-end gap-3"
    >
      <input type="hidden" name="series" value={series} />
      <div>
        <label htmlFor={`${id}-ano`} className={LABEL}>
          Ano
        </label>
        <select
          id={`${id}-ano`}
          name="year"
          value={year}
          onChange={(event) => {
            const chosen = Number(event.target.value);
            setYear(chosen);
            const known = years.find((row) => row.year === chosen);
            if (known) setNext(String(known.next));
          }}
          className={FIELD}
        >
          {years.map((row) => (
            <option key={row.year} value={row.year}>
              {row.year}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-proximo`} className={LABEL}>
          Próximo número
        </label>
        <input
          id={`${id}-proximo`}
          name="next"
          type="number"
          inputMode="numeric"
          min={1}
          required
          value={next}
          onChange={(event) => setNext(event.target.value)}
          aria-invalid={state.status === "error" ? true : undefined}
          aria-describedby={state.status === "error" ? `${id}-erro` : undefined}
          className={`${FIELD} w-32`}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="btn btn-admin-primary btn-md"
      >
        {pending ? "Salvando..." : "Salvar"}
      </button>
      {state.status === "error" && (
        <p
          id={`${id}-erro`}
          role="alert"
          className="basis-full text-[12.5px] font-semibold text-admin-error-text"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
