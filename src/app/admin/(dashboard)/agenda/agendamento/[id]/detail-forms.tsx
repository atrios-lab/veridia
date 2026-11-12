"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import {
  CITIZEN_DOCUMENT_NAMES,
  OFFICE_DOCUMENT_NAMES,
} from "@/core/request/delivery-name.ts";
import { LONG_TEXT_MAX } from "@/core/text-limits.ts";
import { DocumentNameField } from "../../../../../_components/document-name-field.tsx";
import { Button } from "../../../../_ui/button.tsx";
import { cn } from "../../../../_ui/cn.ts";
import { Input } from "../../../../_ui/input.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../../_ui/native-select.tsx";
import { Textarea } from "../../../../_ui/textarea.tsx";
import {
  addNoteAction,
  attachOfficeFilesAction,
  correctAppointmentAction,
  type DetailState,
} from "./actions.ts";

const LABEL = "mb-1 block text-xs font-medium text-foreground";

function Feedback({ state }: { state: DetailState }) {
  if (state.status === "idle") return null;
  return (
    <span
      role={state.status === "error" ? "alert" : "status"}
      className={cn(
        "text-sm font-medium",
        state.status === "error" ? "text-destructive" : "text-success-text",
      )}
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
      <Textarea
        id="nota"
        name="body"
        rows={3}
        maxLength={LONG_TEXT_MAX}
        placeholder="Ex.: cliente avisou que vai chegar 10 minutos atrasado."
        className="field-sizing-fixed bg-background"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Anotar"}
        </Button>
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
        className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-2.5 file:py-1 file:text-sm file:font-medium file:text-foreground"
      />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Anexando…" : "Anexar"}
      </Button>
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
  const uid = useId();
  const text = (
    name: keyof CorrectionValues,
    label: string,
    wide?: boolean,
  ) => (
    <label
      htmlFor={`${uid}-${name}`}
      className={cn("block", wide && "md:col-span-2")}
    >
      <span className={LABEL}>{label}</span>
      <Input
        id={`${uid}-${name}`}
        name={name}
        defaultValue={initial[name]}
        aria-invalid={errors[name] ? true : undefined}
        className="bg-background"
      />
      {errors[name] && (
        <span className="mt-1 block text-xs font-medium text-destructive">
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
      <label htmlFor={`${uid}-serviceId`} className="block">
        <span className={LABEL}>Serviço</span>
        <NativeSelect
          id={`${uid}-serviceId`}
          name="serviceId"
          defaultValue={initial.serviceId}
          className="w-full bg-background"
        >
          {services.map((service) => (
            <NativeSelectOption key={service.id} value={service.id}>
              {service.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </label>
      <label htmlFor={`${uid}-mode`} className="block">
        <span className={LABEL}>Modo</span>
        <NativeSelect
          id={`${uid}-mode`}
          name="mode"
          defaultValue={initial.mode}
          className="w-full bg-background"
        >
          {modes.map((mode) => (
            <NativeSelectOption key={mode} value={mode}>
              {mode}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </label>
      <label htmlFor={`${uid}-serviceDetails`} className="block md:col-span-2">
        <span className={LABEL}>Observação do cliente (o que precisa)</span>
        <Textarea
          id={`${uid}-serviceDetails`}
          name="serviceDetails"
          rows={3}
          defaultValue={initial.serviceDetails}
          maxLength={LONG_TEXT_MAX}
          className="field-sizing-fixed bg-background"
        />
      </label>
      <div className="flex items-center gap-3 md:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar correções"}
        </Button>
        <Feedback state={state} />
      </div>
    </form>
  );
}
