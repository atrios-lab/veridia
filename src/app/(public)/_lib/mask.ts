import type { UseFormRegisterReturn } from "react-hook-form";

/**
 * Format the value in place before react-hook-form reads it, so the citizen
 * sees a CPF or a phone shaped the way they are written down, and the schema
 * still receives what they typed.
 */
export function withMask(
  field: UseFormRegisterReturn,
  format: (value: string) => string,
) {
  return {
    ...field,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      event.target.value = format(event.target.value);
      return field.onChange(event);
    },
  };
}
