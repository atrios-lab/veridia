"use client";

import { useActionState, useEffect, useState } from "react";
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
  // Closed by default, and named for what it does (found on 16/11/2026):
  // laid out like "Nova turma", always open, it was filled in for the next
  // office and saved, renaming this cohort and keeping its link.
  const [open, setOpen] = useState(state.status === "error");
  const [officeName, setOfficeName] = useState(value("officeName"));
  const renaming =
    officeName.trim().replace(/\s+/g, " ") !== current.officeName;
  // Saved: back to the closed card, which says so.
  useEffect(() => {
    if (state.status === "saved") setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          Editar esta turma
        </h2>
        <p className="text-sm text-muted-foreground">
          Corrige os dados desta turma e do link dela. Para outro cartório, use{" "}
          <strong className="text-foreground">Criar outra turma</strong>.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setOfficeName(current.officeName);
              setOpen(true);
            }}
          >
            <AdminIcon name="settings" className="h-4 w-4" />
            Editar dados desta turma
          </Button>
          {state.status === "saved" && (
            <output className="flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-xs font-semibold text-success-text">
              <AdminIcon
                name="check"
                className="h-3.5 w-3.5"
                strokeWidth={2.4}
              />
              Turma atualizada.
            </output>
          )}
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Editar esta turma
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Muda esta turma, com o mesmo link. Não cria uma turma nova.
        </p>
      </div>
      <Field
        name="officeName"
        label="Cartório"
        error={errors.officeName}
        hint="Muda o nome nos próximos certificados. Os já emitidos ficam como estão."
      >
        <Input
          id="officeName"
          name="officeName"
          value={officeName}
          onChange={(event) => setOfficeName(event.target.value)}
          aria-invalid={errors.officeName ? true : undefined}
        />
      </Field>
      {renaming && (
        <p
          role="alert"
          className="rounded-lg border border-warning/40 bg-warning-soft px-3.5 py-2.5 text-sm text-warning-text"
        >
          Você está trocando o cartório <strong>desta turma</strong>, de "
          {current.officeName}". O link continua o mesmo, e quem já entrou ou
          entrar por ele recebe o certificado com o nome novo. Se é outro
          cartório, cancele e use <strong>Criar outra turma</strong>.
        </p>
      )}
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
          {pending
            ? "Salvando…"
            : renaming
              ? "Trocar o cartório desta turma"
              : "Salvar alterações"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setOfficeName(current.officeName);
            setOpen(false);
          }}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
