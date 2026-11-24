"use client";

import { type ComponentProps, useState } from "react";
import { formatMoneyTyping, toMoneyText } from "@/core/money-input.ts";
import { Input } from "../_ui/input.tsx";

type Props = Omit<
  ComponentProps<typeof Input>,
  "value" | "defaultValue" | "onChange" | "type" | "inputMode"
> & {
  /** Uncontrolled: the starting value, in any way money is written. */
  defaultValue?: string | number | null;
  /** Controlled: the text, kept by the caller. */
  value?: string;
  onValueChange?: (value: string) => void;
};

/**
 * A money field that puts the dots and the comma in by itself (decision of
 * 24/11/2026): the digits fill from the cents, as a card machine does
 * (core/money-input.ts). Uncontrolled with `defaultValue`, or controlled
 * with `value` and `onValueChange`.
 */
export function MoneyInput({
  defaultValue,
  value,
  onValueChange,
  placeholder = "0,00",
  ...props
}: Props) {
  const [own, setOwn] = useState(() => toMoneyText(defaultValue ?? ""));
  const controlled = value !== undefined;
  const shown = controlled ? toMoneyText(value) : own;
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={shown}
      onChange={(event) => {
        const next = formatMoneyTyping(event.target.value);
        if (!controlled) setOwn(next);
        onValueChange?.(next);
      }}
    />
  );
}
