"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ limited }: { limited: boolean }) {
  const { pending } = useFormStatus();
  const disabled = limited || pending;
  const label = limited ? "Aguarde…" : pending ? "Entrando…" : "Entrar";

  return (
    <button
      type="submit"
      disabled={disabled}
      className="mt-1 rounded-lg bg-admin-primary-soft px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {label}
    </button>
  );
}
