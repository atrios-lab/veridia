"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AdminIcon } from "./icon.tsx";

/**
 * A file field that looks like one (decision of 11/11/2026): the browser's
 * own "Escolher arquivo" read as plain text and nobody saw it could be
 * clicked. A dashed box with an icon and a real-looking button, then the
 * chosen file's name in its place. The input stays in the form, keyboard
 * and screen reader included.
 */
export function FilePicker({
  name,
  accept,
  label,
  hint,
  required,
}: {
  name: string;
  accept: string;
  label: string;
  hint?: string;
  required?: boolean;
}) {
  const id = useId();
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  // A form cleared after saving clears the name shown here too.
  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const clear = () => setFile(null);
    form.addEventListener("reset", clear);
    return () => form.removeEventListener("reset", clear);
  }, []);

  return (
    <div>
      <span className="mb-1.5 block text-xs font-bold text-admin-primary">
        {label}
      </span>
      <label
        htmlFor={id}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-[12px] border-2 border-dashed px-4 py-5 text-center transition-colors focus-within:ring-2 focus-within:ring-admin-accent hover:border-admin-primary hover:bg-admin-input-bg ${file ? "border-admin-primary-soft bg-admin-input-bg" : "border-admin-input-border bg-admin-card"}`}
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-admin-success-bg text-admin-primary">
          <AdminIcon
            name={file ? "checkCircle" : "upload"}
            className="h-5 w-5"
          />
        </span>
        {file ? (
          <>
            <span className="max-w-full truncate text-[13.5px] font-semibold text-admin-text">
              {file.name}
            </span>
            <span className="text-[11.5px] text-admin-muted">
              {Math.max(1, Math.round(file.size / 1024))} KB · clique para
              trocar
            </span>
          </>
        ) : (
          <>
            <span className="btn btn-admin-primary btn-md pointer-events-none">
              Escolher arquivo
            </span>
            {hint && (
              <span className="text-[11.5px] text-admin-muted">{hint}</span>
            )}
          </>
        )}
        <input
          ref={input}
          id={id}
          name={name}
          type="file"
          accept={accept}
          required={required}
          className="sr-only"
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            setFile(chosen ? { name: chosen.name, size: chosen.size } : null);
          }}
        />
      </label>
    </div>
  );
}
