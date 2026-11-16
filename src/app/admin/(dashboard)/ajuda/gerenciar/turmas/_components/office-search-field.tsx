"use client";

import { useId, useMemo, useState } from "react";
import { type OfficeEntry, searchOffices } from "@/core/cohorts/offices.ts";
import { Input } from "../../../../../_ui/input.tsx";

/**
 * The cohort's office, searched in the official list (decision of
 * 16/11/2026): typing part of the name, the municipality or the CNS shows
 * the offices that match; picking one writes its official name here and
 * hands the rest (city, contact, telephone) to the form. Anything typed by
 * hand is still accepted: an office missing from the list never blocks a
 * cohort.
 */
export function OfficeSearchField({
  offices,
  value,
  onChange,
  onPick,
  invalid,
  describedBy,
}: {
  offices: readonly OfficeEntry[];
  value: string;
  onChange: (value: string) => void;
  onPick: (office: OfficeEntry) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const matches = useMemo(
    () => searchOffices(offices, value),
    [offices, value],
  );
  const shown = open && matches.length > 0;

  const pick = (office: OfficeEntry) => {
    onPick(office);
    setOpen(false);
  };

  return (
    <div className="relative">
      <Input
        id="officeName"
        name="officeName"
        value={value}
        autoComplete="off"
        role="combobox"
        aria-expanded={shown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={shown ? `${listId}-${active}` : undefined}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        placeholder="Digite o nome ou a cidade"
        onChange={(event) => {
          onChange(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // After a click on an option, which lands first.
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(event) => {
          if (!shown) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((i) => (i + 1) % matches.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((i) => (i - 1 + matches.length) % matches.length);
          } else if (event.key === "Enter") {
            event.preventDefault();
            const office = matches[active];
            if (office) pick(office);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {shown && (
        <div
          id={listId}
          role="listbox"
          aria-label="Cartórios encontrados"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {matches.map((office, index) => (
            <div
              key={office.cns}
              id={`${listId}-${index}`}
              role="option"
              // Focus stays in the field (aria-activedescendant), as the
              // combobox pattern has it; -1 only makes the option reachable.
              tabIndex={-1}
              aria-selected={index === active}
              onMouseDown={(event) => {
                event.preventDefault();
                pick(office);
              }}
              onMouseEnter={() => setActive(index)}
              className={`cursor-pointer rounded-sm px-2.5 py-2 text-sm ${
                index === active ? "bg-accent text-accent-foreground" : ""
              }`}
            >
              <span className="block font-medium">{office.name}</span>
              <span className="block text-xs text-muted-foreground">
                {office.city} · CNS {office.cns}
                {office.status ? ` · ${office.status}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
