"use client";

import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";
import { NativeSelect, NativeSelectOption } from "../../_ui/native-select.tsx";

export interface PersonOption {
  value: string;
  label: string;
  href: string;
}

/**
 * "Por pessoa" as one list to choose from (decision of 11/11/2026): an
 * office of fifty people would be a wall of cards; a list reads the same
 * with two or two hundred. The ones with urgent acts waiting come first.
 */
export function PersonPicker({
  options,
  value,
  allHref,
}: {
  options: PersonOption[];
  value: string;
  allHref: string;
}) {
  const router = useRouter();
  const [loading, start] = useTransition();
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-foreground"
    >
      Escolha a pessoa
      <NativeSelect
        id={id}
        value={value}
        disabled={loading}
        onChange={(event) => {
          const next = options.find((o) => o.value === event.target.value);
          start(() => router.push(next?.href ?? allHref, { scroll: false }));
        }}
        className="w-full min-w-0 font-normal"
      >
        <NativeSelectOption value="">
          Todas as pessoas ({options.length})
        </NativeSelectOption>
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </label>
  );
}
