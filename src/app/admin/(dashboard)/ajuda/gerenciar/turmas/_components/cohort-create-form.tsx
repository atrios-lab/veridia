"use client";

import { useActionState } from "react";
import { DEFAULT_COHORT_DAYS } from "@/core/cohorts/cohort.ts";
import { Button } from "../../../../../_ui/button.tsx";
import { Input } from "../../../../../_ui/input.tsx";
import { NativeSelect } from "../../../../../_ui/native-select.tsx";
import { type CohortFormState, createCohortAction } from "../actions.ts";
import { Field, FormError } from "./fields.tsx";

export function CohortCreateForm({
  courses,
}: {
  courses: { id: string; title: string }[];
}) {
  const [state, formAction, pending] = useActionState<
    CohortFormState,
    FormData
  >(createCohortAction, { status: "idle" });
  const errors = state.status === "error" ? state.fieldErrors : {};
  const sent = state.status === "error" ? state.values : undefined;

  return (
    <div className="rounded-xl border bg-card p-6">
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
            hint="Como deve sair no certificado."
          >
            <Input
              id="officeName"
              name="officeName"
              defaultValue={sent?.officeName}
              placeholder="2º Ofício de Notas de Exemplo/RN"
              aria-invalid={errors.officeName ? true : undefined}
            />
          </Field>
          <Field name="officeCity" label="Cidade" error={errors.officeCity}>
            <Input
              id="officeCity"
              name="officeCity"
              defaultValue={sent?.officeCity}
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
                defaultValue={sent?.contactName}
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
                defaultValue={sent?.contactPhone}
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
