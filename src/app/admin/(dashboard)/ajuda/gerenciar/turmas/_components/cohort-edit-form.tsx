"use client";

import { useActionState } from "react";
import { AdminIcon } from "../../../../../_components/icon.tsx";
import { Button } from "../../../../../_ui/button.tsx";
import { Input } from "../../../../../_ui/input.tsx";
import { type CohortFormState, updateCohortAction } from "../actions.ts";
import { Field, FormError } from "./fields.tsx";

export interface CohortEditValues {
  officeName: string;
  officeCity: string;
  contactName: string;
  contactPhone: string;
  seats: number;
  /** "YYYY-MM-DD", the link's last valid day. */
  lastDay: string;
}

export function CohortEditForm({
  cohortId,
  current,
}: {
  cohortId: string;
  current: CohortEditValues;
}) {
  const [state, formAction, pending] = useActionState<
    CohortFormState,
    FormData
  >(updateCohortAction.bind(null, cohortId), { status: "idle" });
  const errors = state.status === "error" ? state.fieldErrors : {};
  const value = (key: keyof CohortEditValues) =>
    state.status === "error" ? state.values[key] : String(current[key]);

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <Field
        name="officeName"
        label="Cartório"
        error={errors.officeName}
        hint="Muda o nome nos próximos certificados. Os já emitidos ficam como estão."
      >
        <Input
          id="officeName"
          name="officeName"
          defaultValue={value("officeName")}
          aria-invalid={errors.officeName ? true : undefined}
        />
      </Field>
      <Field name="officeCity" label="Cidade" error={errors.officeCity}>
        <Input
          id="officeCity"
          name="officeCity"
          defaultValue={value("officeCity")}
          aria-invalid={errors.officeCity ? true : undefined}
        />
      </Field>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <Field
          name="contactName"
          label="Responsável"
          error={errors.contactName}
        >
          <Input
            id="contactName"
            name="contactName"
            defaultValue={value("contactName")}
            aria-invalid={errors.contactName ? true : undefined}
          />
        </Field>
        <Field name="contactPhone" label="Telefone" error={errors.contactPhone}>
          <Input
            id="contactPhone"
            name="contactPhone"
            type="tel"
            defaultValue={value("contactPhone")}
            aria-invalid={errors.contactPhone ? true : undefined}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3.5">
        <Field name="seats" label="Vagas" error={errors.seats}>
          <Input
            id="seats"
            name="seats"
            type="number"
            min={1}
            defaultValue={value("seats")}
            aria-invalid={errors.seats ? true : undefined}
          />
        </Field>
        <Field name="lastDay" label="Link vale até" error={errors.lastDay}>
          <Input
            id="lastDay"
            name="lastDay"
            type="date"
            defaultValue={value("lastDay")}
            aria-invalid={errors.lastDay ? true : undefined}
          />
        </Field>
      </div>

      <FormError
        message={state.status === "error" ? state.message : undefined}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar alterações"}
        </Button>
        {state.status === "saved" && (
          <output className="flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-xs font-semibold text-success-text">
            <AdminIcon name="check" className="h-3.5 w-3.5" strokeWidth={2.4} />
            Turma atualizada.
          </output>
        )}
      </div>
    </form>
  );
}
