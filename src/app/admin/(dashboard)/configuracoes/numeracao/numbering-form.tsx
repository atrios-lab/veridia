"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import type { NumberSeries } from "@/core/numbering/series.ts";
import { Button } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import { Label } from "../../../_ui/label.tsx";
import { NativeSelect } from "../../../_ui/native-select.tsx";
import { type NumberingState, saveNumbering } from "./actions.ts";

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
        <Label htmlFor={`${id}-ano`} className="mb-1.5">
          Ano
        </Label>
        <NativeSelect
          id={`${id}-ano`}
          name="year"
          value={year}
          onChange={(event) => {
            const chosen = Number(event.target.value);
            setYear(chosen);
            const known = years.find((row) => row.year === chosen);
            if (known) setNext(String(known.next));
          }}
        >
          {years.map((row) => (
            <option key={row.year} value={row.year}>
              {row.year}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div>
        <Label htmlFor={`${id}-proximo`} className="mb-1.5">
          Próximo número
        </Label>
        <Input
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
          className="w-32"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar"}
      </Button>
      {state.status === "error" && (
        <p
          id={`${id}-erro`}
          role="alert"
          className="basis-full text-sm text-destructive"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
