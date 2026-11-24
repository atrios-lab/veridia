"use client";

import { type ComponentProps, useState } from "react";
import { formatCpf } from "@/core/request/form.ts";
import { formatTaxId } from "@/core/tax-id.ts";
import { formatCnpj } from "@/core/tenant/pix.ts";
import { Input } from "../_ui/input.tsx";

/** CPF only, CNPJ only, or either (11 digits a CPF, 14 a CNPJ). */
export type TaxIdKind = "cpf" | "cnpj" | "any";

const FORMAT: Record<TaxIdKind, (value: string) => string> = {
  cpf: formatCpf,
  cnpj: (value) => formatCnpj(value.replace(/\D/g, "").slice(0, 14)),
  any: formatTaxId,
};

const PLACEHOLDER: Record<TaxIdKind, string> = {
  cpf: "000.000.000-00",
  cnpj: "00.000.000/0000-00",
  any: "Só os números: a pontuação entra sozinha",
};

type Props = Omit<
  ComponentProps<typeof Input>,
  "value" | "defaultValue" | "onChange" | "type" | "inputMode"
> & {
  kind?: TaxIdKind;
  /** Uncontrolled: the starting value, with or without punctuation. */
  defaultValue?: string | null;
  /** Controlled: the text, kept by the caller. */
  value?: string;
  onValueChange?: (value: string) => void;
};

/**
 * A CPF or CNPJ field that puts the dots, the slash and the dash in as the
 * digits are typed (decisions of 11/11/2026 and 24/11/2026). What is
 * posted is what is shown. Uncontrolled with `defaultValue`, or controlled
 * with `value` and `onValueChange`.
 */
export function TaxIdInput({
  kind = "any",
  defaultValue,
  value,
  onValueChange,
  placeholder,
  ...props
}: Props) {
  const format = FORMAT[kind];
  const [own, setOwn] = useState(() => format(defaultValue ?? ""));
  const controlled = value !== undefined;
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder ?? PLACEHOLDER[kind]}
      value={controlled ? format(value) : own}
      onChange={(event) => {
        const next = format(event.target.value);
        if (!controlled) setOwn(next);
        onValueChange?.(next);
      }}
    />
  );
}
