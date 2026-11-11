"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

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
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-bold text-admin-primary">
      Escolha a pessoa
      <select
        value={value}
        disabled={loading}
        onChange={(event) => {
          const next = options.find((o) => o.value === event.target.value);
          start(() => router.push(next?.href ?? allHref, { scroll: false }));
        }}
        className="w-full min-w-0 rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3 py-2.5 text-[13.5px] font-normal text-admin-text outline-none focus:border-admin-primary-soft"
      >
        <option value="">Todas as pessoas ({options.length})</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
