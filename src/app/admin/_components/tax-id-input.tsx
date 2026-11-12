"use client";

import { useState } from "react";
import { formatTaxId } from "@/core/tax-id.ts";
import { Input } from "../_ui/input.tsx";

/**
 * A CPF or CNPJ field that puts the dots, the slash and the dash in as the
 * digits are typed (decision of 11/11/2026): 11 digits read as a CPF, 14 as
 * a CNPJ. What is posted is what is shown.
 *
 * The panel's `Input`: `className` goes on top of its look, so a caller
 * passes only what differs (a width, say).
 */
export function TaxIdInput({
  name,
  defaultValue,
  className,
  placeholder = "Só os números: a pontuação entra sozinha",
  id,
}: {
  name: string;
  defaultValue: string;
  className: string;
  placeholder?: string;
  id?: string;
}) {
  const [value, setValue] = useState(formatTaxId(defaultValue));
  return (
    <Input
      id={id}
      name={name}
      inputMode="numeric"
      autoComplete="off"
      value={value}
      placeholder={placeholder}
      onChange={(event) => setValue(formatTaxId(event.target.value))}
      className={className}
    />
  );
}
