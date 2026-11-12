"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { DOCUMENT_CATEGORIES } from "@/core/transparency/documents.ts";
import { Button } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import { Label } from "../../../_ui/label.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../_ui/native-select.tsx";
import { type SaveState, uploadDocumentAction } from "../actions.ts";

const LABEL_CLASS = "mb-1.5";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-xs font-medium text-destructive">{message}</p>
  );
}

/**
 * The "Subir documento" panel. Every upload lands as a draft (the button
 * says so), and the form clears itself on success so the next document starts
 * clean.
 */
export function DocumentForm() {
  const [state, formAction, pending] = useActionState<SaveState, FormData>(
    uploadDocumentAction,
    { status: "idle" },
  );
  const fieldErrors = state.status === "error" ? state.fieldErrors : {};
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      toast.success("Documento enviado como rascunho.");
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-xl border border-border bg-card p-5"
    >
      <h3 className="text-lg font-semibold text-foreground">Subir documento</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        O documento entra como rascunho. Ele só aparece no site depois que você
        publicar.
      </p>

      <div className="mt-4">
        <Label htmlFor="doc-category" className={LABEL_CLASS}>
          Categoria
        </Label>
        <NativeSelect
          id="doc-category"
          name="category"
          defaultValue={DOCUMENT_CATEGORIES[0]}
          aria-invalid={fieldErrors.category ? true : undefined}
          className="w-full"
        >
          {DOCUMENT_CATEGORIES.map((c) => (
            <NativeSelectOption key={c} value={c}>
              {c}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <FieldError message={fieldErrors.category} />
      </div>

      <div className="mt-3.5">
        <Label htmlFor="doc-title" className={LABEL_CLASS}>
          Nome do documento
        </Label>
        <Input
          id="doc-title"
          name="title"
          type="text"
          placeholder="Ex.: Tabela de custas 2026"
          aria-invalid={fieldErrors.title ? true : undefined}
        />
        <FieldError message={fieldErrors.title} />
      </div>

      <div className="mt-3.5">
        <Label htmlFor="doc-year" className={LABEL_CLASS}>
          Ano ou vigência
        </Label>
        <Input
          id="doc-year"
          name="yearLabel"
          type="text"
          placeholder="Ex.: 2026 ou vigência 19/03/2026"
          aria-invalid={fieldErrors.yearLabel ? true : undefined}
        />
        <FieldError message={fieldErrors.yearLabel} />
      </div>

      <div className="mt-3.5">
        <span className="mb-1.5 block text-sm font-medium text-foreground">
          Arquivo (PDF)
        </span>
        <label className="relative flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-input px-4 py-4 text-center text-sm font-medium text-foreground hover:bg-muted/50 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          Escolher PDF ou arrastar para cá
          <input
            type="file"
            name="arquivo"
            accept="application/pdf"
            className="sr-only"
          />
        </label>
        <FieldError message={fieldErrors.arquivo} />
        <p className="mt-2 text-xs text-muted-foreground">Só PDF, até 8 MB.</p>
      </div>

      {state.status === "error" && !Object.keys(fieldErrors).length && (
        <p role="alert" className="mt-3 text-xs font-medium text-destructive">
          {state.message}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="mt-4 w-full"
      >
        {pending ? "Enviando…" : "Enviar como rascunho"}
      </Button>
    </form>
  );
}
