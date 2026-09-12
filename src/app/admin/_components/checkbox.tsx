import type { InputHTMLAttributes } from "react";

/**
 * The panel's checkbox. The drawing lives in `.checkbox-admin` (globals.css);
 * this only insists on a label, because a bare square in a table row says
 * nothing to a screen reader about which protocol it selects.
 */
export function Checkbox({
  label,
  ...props
}: {
  /** What checking it means, e.g. "Selecionar protocolo REQ.2026.000482". */
  label: string;
} & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "className" | "aria-label"
>) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      className="checkbox-admin"
      {...props}
    />
  );
}
