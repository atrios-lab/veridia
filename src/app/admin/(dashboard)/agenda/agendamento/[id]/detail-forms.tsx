"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  CITIZEN_DOCUMENT_NAMES,
  OFFICE_DOCUMENT_NAMES,
} from "@/core/request/delivery-name.ts";
import { DocumentNameField } from "../../../../../_components/document-name-field.tsx";
import {
  addNoteAction,
  attachOfficeFilesAction,
  correctAppointmentAction,
  type DetailState,
} from "./actions.ts";

const FIELD =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3 py-2 text-[13px] text-admin-text outline-none focus:border-admin-primary-soft";
const FIELD_ERROR =
  "w-full rounded-[9px] border border-admin-error-border bg-admin-error-input-bg px-3 py-2 text-[13px] text-admin-text outline-none focus:border-admin-error-text";
const LABEL = "mb-1 block text-[11.5px] font-bold text-admin-primary";

function Feedback({ state }: { state: DetailState }) {
  if (state.status === "idle") return null;
  return (
    <span
      role={state.status === "error" ? "alert" : "status"}
      className={`text-[12.5px] font-semibold ${state.status === "error" ? "text-admin-error-text" : "text-admin-success-text"}`}
    >
      {state.message}
    </span>
  );
}

/** A new internal note; the box empties once it is saved. */
export function NoteForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<DetailState, FormData>(
    addNoteAction,
    {
      status: "idle",
    },
  );
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success") form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="mt-3 flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="sr-only" htmlFor="nota">
        Nova anotação
      </label>
      <textarea
        id="nota"
        name="body"
        rows={3}
        maxLength={4000}
        placeholder="Ex.: cliente avisou que vai chegar 10 minutos atrasado."
        className={FIELD}
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-admin-primary btn-md"
        >
          {pending ? "Salvando…" : "Anotar"}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

/** Files the office keeps with the appointment. */
export function OfficeFilesForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<DetailState, FormData>(
    attachOfficeFilesAction,
    { status: "idle" },
  );
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success") form.current?.reset();
  }, [state]);
  return (
    <form
      ref={form}
      action={action}
      className="mt-3 flex flex-wrap items-center gap-3"
    >
      <input type="hidden" name="id" value={id} />
      <div className="basis-full">
        <DocumentNameField
          field="arquivo"
          tone="admin"
          suggestions={[...OFFICE_DOCUMENT_NAMES, ...CITIZEN_DOCUMENT_NAMES]}
        />
      </div>
      <label className="sr-only" htmlFor="arquivo">
        Arquivo
      </label>
      <input
        id="arquivo"
        name="arquivo"
        type="file"
        multiple
        className="text-[12.5px]"
      />
      <button
        type="submit"
        disabled={pending}
        className="btn btn-admin-secondary btn-md"
      >
        {pending ? "Anexando…" : "Anexar"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export interface CorrectionValues {
  citizenName: string;
  email: string;
  phone: string;
  cpf: string;
  serviceId: string;
  mode: string;
  serviceDetails: string;
}

/** The citizen's data, to correct what was typed wrong. */
export function CorrectionForm({
  id,
  initial,
  services,
  modes,
}: {
  id: string;
  initial: CorrectionValues;
  services: { id: string; label: string }[];
  modes: string[];
}) {
  const [state, action, pending] = useActionState<DetailState, FormData>(
    correctAppointmentAction,
    { status: "idle" },
  );
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const text = (
    name: keyof CorrectionValues,
    label: string,
    wide?: boolean,
  ) => (
    <label className={`block ${wide ? "md:col-span-2" : ""}`}>
      <span className={LABEL}>{label}</span>
      <input
        name={name}
        defaultValue={initial[name]}
        aria-invalid={errors[name] ? true : undefined}
        className={errors[name] ? FIELD_ERROR : FIELD}
      />
      {errors[name] && (
        <span className="mt-1 block text-[11.5px] font-semibold text-admin-error-text">
          {errors[name]}
        </span>
      )}
    </label>
  );
  return (
    <form
      action={action}
      className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2"
    >
      <input type="hidden" name="id" value={id} />
      {text("citizenName", "Nome", true)}
      {text("cpf", "CPF")}
      {text("phone", "Telefone")}
      {text("email", "E-mail", true)}
      <label className="block">
        <span className={LABEL}>Serviço</span>
        <select
          name="serviceId"
          defaultValue={initial.serviceId}
          className={FIELD}
        >
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={LABEL}>Modo</span>
        <select name="mode" defaultValue={initial.mode} className={FIELD}>
          {modes.map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </select>
      </label>
      <label className="block md:col-span-2">
        <span className={LABEL}>Observação do cliente (o que precisa)</span>
        <textarea
          name="serviceDetails"
          rows={3}
          defaultValue={initial.serviceDetails}
          maxLength={2000}
          className={FIELD}
        />
      </label>
      <div className="flex items-center gap-3 md:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-admin-primary btn-md"
        >
          {pending ? "Salvando…" : "Salvar correções"}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}
