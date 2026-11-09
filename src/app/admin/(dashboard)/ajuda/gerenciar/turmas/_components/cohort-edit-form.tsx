"use client";

import { useActionState } from "react";
import { AdminIcon } from "../../../../../_components/icon.tsx";
import { type CohortFormState, updateCohortAction } from "../actions.ts";
import { Field, FormError, fieldClass } from "./fields.tsx";

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
        <input
          id="officeName"
          name="officeName"
          defaultValue={value("officeName")}
          className={fieldClass(errors.officeName)}
        />
      </Field>
      <Field name="officeCity" label="Cidade" error={errors.officeCity}>
        <input
          id="officeCity"
          name="officeCity"
          defaultValue={value("officeCity")}
          className={fieldClass(errors.officeCity)}
        />
      </Field>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <Field
          name="contactName"
          label="Responsável"
          error={errors.contactName}
        >
          <input
            id="contactName"
            name="contactName"
            defaultValue={value("contactName")}
            className={fieldClass(errors.contactName)}
          />
        </Field>
        <Field name="contactPhone" label="Telefone" error={errors.contactPhone}>
          <input
            id="contactPhone"
            name="contactPhone"
            type="tel"
            defaultValue={value("contactPhone")}
            className={fieldClass(errors.contactPhone)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3.5">
        <Field name="seats" label="Vagas" error={errors.seats}>
          <input
            id="seats"
            name="seats"
            type="number"
            min={1}
            defaultValue={value("seats")}
            className={fieldClass(errors.seats)}
          />
        </Field>
        <Field name="lastDay" label="Link vale até" error={errors.lastDay}>
          <input
            id="lastDay"
            name="lastDay"
            type="date"
            defaultValue={value("lastDay")}
            className={fieldClass(errors.lastDay)}
          />
        </Field>
      </div>

      <FormError
        message={state.status === "error" ? state.message : undefined}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-admin-primary btn-md"
        >
          {pending ? "Salvando…" : "Salvar alterações"}
        </button>
        {state.status === "saved" && (
          <output className="flex items-center gap-1.5 rounded-full bg-admin-success-bg px-3 py-1.5 text-[12.5px] font-semibold text-admin-success-text">
            <AdminIcon name="check" className="h-3.5 w-3.5" strokeWidth={2.4} />
            Turma atualizada.
          </output>
        )}
      </div>
    </form>
  );
}
