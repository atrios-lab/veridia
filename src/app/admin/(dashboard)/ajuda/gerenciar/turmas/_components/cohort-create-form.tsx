"use client";

import { useActionState, useEffect, useState } from "react";
import { DEFAULT_COHORT_DAYS } from "@/core/cohorts/cohort.ts";
import type { OfficeEntry } from "@/core/cohorts/offices.ts";
import { Button } from "../../../../../_ui/button.tsx";
import { Input } from "../../../../../_ui/input.tsx";
import { NativeSelect } from "../../../../../_ui/native-select.tsx";
import { type CohortFormState, createCohortAction } from "../actions.ts";
import { Field, FormError } from "./fields.tsx";
import { OfficeSearchField } from "./office-search-field.tsx";

export function CohortCreateForm({
  courses,
  offices,
}: {
  courses: { id: string; title: string }[];
  /** The official list the Cartório field searches (core/cohorts). */
  offices: readonly OfficeEntry[];
}) {
  const [state, formAction, pending] = useActionState<
    CohortFormState,
    FormData
  >(createCohortAction, { status: "idle" });
  const errors = state.status === "error" ? state.fieldErrors : {};
  const sent = state.status === "error" ? state.values : undefined;
  // Held here, not in the inputs, so picking an office can fill the city,
  // the contact and the telephone; a refused submit puts back what was sent.
  const [office, setOffice] = useState({
    officeName: "",
    officeCity: "",
    contactName: "",
    contactPhone: "",
  });
  const [picked, setPicked] = useState<OfficeEntry | null>(null);
  useEffect(() => {
    if (state.status !== "error") return;
    setOffice({
      officeName: state.values.officeName ?? "",
      officeCity: state.values.officeCity ?? "",
      contactName: state.values.contactName ?? "",
      contactPhone: state.values.contactPhone ?? "",
    });
  }, [state]);
  const field =
    (key: keyof typeof office) => (event: { target: { value: string } }) =>
      setOffice((current) => ({ ...current, [key]: event.target.value }));

  return (
    <div id="nova-turma" className="scroll-mt-20 rounded-xl border bg-card p-6">
      <h2 className="text-lg font-semibold text-foreground">Nova turma</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Um link por cartório. O responsável repassa para a equipe, e cada pessoa
        cria a própria conta.
      </p>

      {courses.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Nenhum curso emite certificado ainda. Defina a carga horária de um
          curso em Gerenciar vídeos.
        </p>
      ) : (
        <form action={formAction} className="mt-4 flex flex-col gap-3.5">
          <Field name="courseId" label="Curso" error={errors.courseId}>
            <NativeSelect
              id="courseId"
              name="courseId"
              defaultValue={sent?.courseId ?? courses[0]?.id}
              className="w-full"
              aria-invalid={errors.courseId ? true : undefined}
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field
            name="officeName"
            label="Cartório"
            error={errors.officeName}
            hint="Busque na lista oficial do RN pelo nome, cidade ou CNS: a cidade, o responsável e o telefone vêm junto. Não achou? Digite o nome como deve sair no certificado."
          >
            <OfficeSearchField
              offices={offices}
              value={office.officeName}
              // Typing another name drops what the last pick filled in and
              // the person has not changed since: an office typed by hand
              // never keeps the city and contact of the one picked before.
              onChange={(value) => {
                setOffice((current) => {
                  const next = { ...current, officeName: value };
                  if (!picked || value === picked.name) return next;
                  if (current.officeCity === picked.city) next.officeCity = "";
                  if (current.contactName === (picked.contactName ?? ""))
                    next.contactName = "";
                  if (current.contactPhone === (picked.contactPhone ?? ""))
                    next.contactPhone = "";
                  return next;
                });
                if (picked && value !== picked.name) setPicked(null);
              }}
              // The four together: what the list lacks stays empty to type,
              // never a value left from the office picked before.
              onPick={(entry) => {
                setPicked(entry);
                setOffice({
                  officeName: entry.name,
                  officeCity: entry.city,
                  contactName: entry.contactName ?? "",
                  contactPhone: entry.contactPhone ?? "",
                });
              }}
              invalid={Boolean(errors.officeName)}
            />
          </Field>
          <Field name="officeCity" label="Cidade" error={errors.officeCity}>
            <Input
              id="officeCity"
              name="officeCity"
              value={office.officeCity}
              onChange={field("officeCity")}
              placeholder="Exemplo/RN"
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
                value={office.contactName}
                onChange={field("contactName")}
                aria-invalid={errors.contactName ? true : undefined}
              />
            </Field>
            <Field
              name="contactPhone"
              label="Telefone"
              error={errors.contactPhone}
            >
              <Input
                id="contactPhone"
                name="contactPhone"
                type="tel"
                value={office.contactPhone}
                onChange={field("contactPhone")}
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
                defaultValue={sent?.seats ?? "15"}
                aria-invalid={errors.seats ? true : undefined}
              />
            </Field>
            <Field
              name="validDays"
              label="Validade (dias)"
              error={errors.validDays}
            >
              <Input
                id="validDays"
                name="validDays"
                type="number"
                min={1}
                defaultValue={sent?.validDays ?? String(DEFAULT_COHORT_DAYS)}
                aria-invalid={errors.validDays ? true : undefined}
              />
            </Field>
          </div>

          <FormError
            message={state.status === "error" ? state.message : undefined}
          />

          <Button type="submit" disabled={pending} size="lg">
            {pending ? "Criando…" : "Criar turma"}
          </Button>
        </form>
      )}
    </div>
  );
}
