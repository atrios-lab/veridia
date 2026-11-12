"use client";

import { useId, useState } from "react";
import { AdminIcon } from "../../../_components/icon.tsx";
import { buttonVariants } from "../../../_ui/button.tsx";

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
      <span className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </span>
      <label
        htmlFor={id}
        className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed border-input bg-card px-4 py-4 text-center focus-within:ring-3 focus-within:ring-ring/50 hover:border-primary hover:bg-muted/50"
      >
        <AdminIcon name="upload" className="h-5 w-5 text-foreground" />
        <span className={buttonVariants({ variant: "outline", size: "sm" })}>
          Escolher arquivos
        </span>
        <span className="text-xs text-muted-foreground">
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
