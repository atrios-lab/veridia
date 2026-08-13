"use client";

import { useId, useState } from "react";
import { AdminIcon } from "./icon.tsx";

export function PasswordField({
  label,
  name,
  autoComplete,
}: {
  label: string;
  name: string;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-bold text-admin-primary"
      >
        {label}
      </label>
      <div className="flex items-center rounded-lg border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 focus-within:border-admin-accent focus-within:ring-2 focus-within:ring-admin-accent">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          className="min-w-0 flex-1 bg-transparent text-sm text-admin-text outline-none focus-visible:shadow-none"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="shrink-0 text-admin-faint hover:text-admin-muted"
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        >
          <AdminIcon name={visible ? "eyeOff" : "eye"} className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
