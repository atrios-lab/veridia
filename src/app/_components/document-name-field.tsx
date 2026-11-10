"use client";

import { useEffect, useId, useRef, useState } from "react";

const STYLES = {
  admin: {
    label: "mb-1.5 block text-xs font-bold text-admin-primary",
    input:
      "min-w-0 flex-1 rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft",
    button: "btn btn-admin-secondary btn-md shrink-0",
    menu: "border-admin-border bg-admin-card",
    item: "text-admin-text hover:bg-admin-input-bg",
    hint: "mt-1 text-[11.5px] text-admin-muted",
  },
  public: {
    label: "mb-1.5 block text-sm font-semibold text-brand-primary",
    input:
      "min-w-0 flex-1 rounded-xl border border-brand-border bg-brand-surface px-3.5 py-3 text-sm text-brand-text outline-none placeholder:text-brand-faint focus:border-brand-accent",
    button: "btn btn-secondary btn-md shrink-0",
    menu: "border-brand-border bg-brand-surface",
    item: "text-brand-text hover:bg-brand-tint",
    hint: "mt-1 text-xs text-brand-muted",
  },
} as const;

/**
 * "Nome do documento", with the usual names one click away behind a single
 * button (decision of 10/11/2026): the file is found by its name later, by
 * the office and by the citizen. Posts as `<field>Name`, which the server
 * reads next to the files of `<field>` (lib/uploads.ts).
 */
export function DocumentNameField({
  field,
  suggestions,
  tone,
  placeholder,
  hint,
  compactLabel,
}: {
  field: string;
  suggestions: readonly string[];
  tone: "admin" | "public";
  placeholder?: string;
  hint?: string;
  /** In a list of files: no visible label, this one read aloud instead. */
  compactLabel?: string;
}) {
  const style = STYLES[tone];
  const id = useId();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setOpen(false);
        return;
      }
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div>
      <label
        htmlFor={`${id}-nome`}
        className={compactLabel ? "sr-only" : style.label}
      >
        {compactLabel ?? "Nome do documento (opcional)"}
      </label>
      <div ref={box} className="relative flex gap-2">
        <input
          id={`${id}-nome`}
          name={`${field}Name`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={100}
          placeholder={placeholder ?? "Ex.: Comprovante de residência"}
          autoComplete="off"
          className={style.input}
        />
        <button
          type="button"
          aria-haspopup="true"
          aria-expanded={open}
          aria-controls={`${id}-opcoes`}
          onClick={() => setOpen((current) => !current)}
          className={style.button}
        >
          Sugestões ▾
        </button>
        {open && (
          <ul
            id={`${id}-opcoes`}
            aria-label="Nomes sugeridos"
            className={`absolute top-full right-0 z-30 mt-1 max-h-72 w-full max-w-sm overflow-y-auto rounded-[12px] border p-1 shadow-lg ${style.menu}`}
          >
            {suggestions.map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  onClick={() => {
                    setValue(suggestion);
                    setOpen(false);
                  }}
                  className={`block w-full rounded-[8px] px-3 py-2 text-left text-[13px] ${style.item}`}
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {hint && <p className={style.hint}>{hint}</p>}
    </div>
  );
}
