"use client";

import { useId, useState } from "react";
import { AdminIcon } from "../../../_components/icon.tsx";

/** Several images or PDFs at once, shown by name once chosen. */
export function EvidenceFiles({
  name,
  label,
}: {
  name: string;
  label: string;
}) {
  const id = useId();
  const [files, setFiles] = useState<string[]>([]);
  return (
    <div>
      <span className="mb-1.5 block text-xs font-bold text-admin-primary">
        {label}
      </span>
      <label
        htmlFor={id}
        className="flex cursor-pointer flex-col items-center gap-1.5 rounded-[12px] border-2 border-dashed border-admin-input-border bg-admin-card px-4 py-4 text-center focus-within:ring-2 focus-within:ring-admin-accent hover:border-admin-primary hover:bg-admin-input-bg"
      >
        <AdminIcon name="upload" className="h-5 w-5 text-admin-primary" />
        <span className="btn btn-admin-secondary btn-sm">
          Escolher arquivos
        </span>
        <span className="text-[11.5px] text-admin-muted">
          {files.length
            ? files.join(", ")
            : "Imagens (JPG, PNG, WEBP) ou PDF, até 10 MB cada"}
        </span>
        <input
          id={id}
          type="file"
          name={name}
          multiple
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
          className="sr-only"
          onChange={(event) =>
            setFiles(Array.from(event.target.files ?? []).map((f) => f.name))
          }
        />
      </label>
    </div>
  );
}
