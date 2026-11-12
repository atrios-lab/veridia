"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * The two faces draw the same field. The panel's tone is the panel's theme
 * (admin.css): the look of _ui's Input, outline Button and popover, written
 * out here because this file also serves the public site, which may not
 * import the panel's kit. The public tone is the office's palette
 * (brand.css).
 */
const STYLES = {
  admin: {
    label: "mb-2 block text-sm leading-none font-medium text-foreground",
    input:
      "h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2.5 py-1 text-base text-foreground shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm",
    button:
      "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-sm font-medium whitespace-nowrap text-foreground shadow-xs transition-all outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted",
    menu: "rounded-md bg-popover text-popover-foreground ring-1 ring-foreground/10",
    item: "rounded-sm text-sm text-foreground hover:bg-accent hover:text-accent-foreground",
    hint: "mt-2 text-sm text-muted-foreground",
  },
  public: {
    label: "mb-1.5 block text-sm font-semibold text-brand-primary",
    input:
      "min-w-0 flex-1 rounded-xl border border-brand-border bg-brand-surface px-3.5 py-3 text-sm text-brand-text outline-none placeholder:text-brand-faint focus:border-brand-accent",
    button: "btn btn-secondary btn-md shrink-0",
    menu: "rounded-[12px] border border-brand-border bg-brand-surface",
    item: "rounded-[8px] text-[13px] text-brand-text hover:bg-brand-tint",
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
            className={`absolute top-full right-0 z-30 mt-1 max-h-72 w-full max-w-sm overflow-y-auto p-1 shadow-lg ${style.menu}`}
          >
            {suggestions.map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  onClick={() => {
                    setValue(suggestion);
                    setOpen(false);
                  }}
                  className={`block w-full px-3 py-2 text-left ${style.item}`}
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
