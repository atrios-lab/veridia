"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { DOCUMENT_CATEGORIES } from "@/core/transparency/documents.ts";
import { type SaveState, uploadDocumentAction } from "../actions.ts";

const FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";
const ERROR_FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-error-border bg-admin-error-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-error-text";
const LABEL_CLASS = "mb-1.5 block text-xs font-bold text-admin-primary";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-xs font-semibold text-admin-error-text">
      {message}
    </p>
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
      className="rounded-[14px] border border-admin-border bg-admin-card p-5"
    >
      <h3 className="font-serif text-[16px] font-semibold text-admin-primary">
        Subir documento
      </h3>
      <p className="mt-1 text-[12.5px] leading-relaxed text-admin-muted">
        O documento entra como rascunho. Ele só aparece no site depois que você
        publicar.
      </p>

      <div className="mt-4">
        <label htmlFor="doc-category" className={LABEL_CLASS}>
          Categoria
        </label>
        <select
          id="doc-category"
          name="category"
          defaultValue={DOCUMENT_CATEGORIES[0]}
          className={fieldErrors.category ? ERROR_FIELD_CLASS : FIELD_CLASS}
        >
          {DOCUMENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <FieldError message={fieldErrors.category} />
      </div>

      <div className="mt-3.5">
        <label htmlFor="doc-title" className={LABEL_CLASS}>
          Nome do documento
        </label>
        <input
          id="doc-title"
          name="title"
          type="text"
          placeholder="Ex.: Tabela de custas 2026"
          className={fieldErrors.title ? ERROR_FIELD_CLASS : FIELD_CLASS}
        />
        <FieldError message={fieldErrors.title} />
      </div>

      <div className="mt-3.5">
        <label htmlFor="doc-year" className={LABEL_CLASS}>
          Ano ou vigência
        </label>
        <input
          id="doc-year"
          name="yearLabel"
          type="text"
          placeholder="Ex.: 2026 ou vigência 19/03/2026"
          className={fieldErrors.yearLabel ? ERROR_FIELD_CLASS : FIELD_CLASS}
        />
        <FieldError message={fieldErrors.yearLabel} />
      </div>

      <div className="mt-3.5">
        <span className={LABEL_CLASS}>Arquivo (PDF)</span>
        <label className="relative flex cursor-pointer items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-dashed border-admin-input-border px-4 py-4 text-center text-[13px] font-semibold text-admin-primary focus-within:border-admin-accent focus-within:ring-2 focus-within:ring-admin-accent">
          Escolher PDF ou arrastar para cá
          <input
            type="file"
            name="arquivo"
            accept="application/pdf"
            className="sr-only"
          />
        </label>
        <FieldError message={fieldErrors.arquivo} />
        <p className="mt-2 text-[11.5px] text-admin-faint">Só PDF, até 8 MB.</p>
      </div>

      {state.status === "error" && !Object.keys(fieldErrors).length && (
        <p
          role="alert"
          className="mt-3 text-[12.5px] font-semibold text-admin-error-text"
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-admin-primary btn-lg mt-4 w-full"
      >
        {pending ? "Enviando…" : "Enviar como rascunho"}
      </button>
    </form>
  );
}
