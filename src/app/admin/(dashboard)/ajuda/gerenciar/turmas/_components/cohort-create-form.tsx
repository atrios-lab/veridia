"use client";

import { useActionState } from "react";
import { DEFAULT_COHORT_DAYS } from "@/core/cohorts/cohort.ts";
import { type CohortFormState, createCohortAction } from "../actions.ts";
import { Field, FormError, fieldClass } from "./fields.tsx";

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
    <div className="rounded-2xl border border-admin-active-border bg-admin-card p-5.5">
      <h2 className="font-serif text-base font-semibold text-admin-primary">
        Nova turma
      </h2>
      <p className="mt-0.5 text-[11.5px] text-admin-muted">
        Um link por cartório. O responsável repassa para a equipe, e cada pessoa
        cria a própria conta.
      </p>

      {courses.length === 0 ? (
        <p className="mt-4 text-[13px] text-admin-muted">
          Nenhum curso emite certificado ainda. Defina a carga horária de um
          curso em Gerenciar vídeos.
        </p>
      ) : (
        <form action={formAction} className="mt-4 flex flex-col gap-3.5">
          <Field name="courseId" label="Curso" error={errors.courseId}>
            <select
              id="courseId"
              name="courseId"
              defaultValue={sent?.courseId ?? courses[0]?.id}
              className={fieldClass(errors.courseId)}
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </Field>
          <Field
            name="officeName"
            label="Cartório"
            error={errors.officeName}
            hint="Como deve sair no certificado."
          >
            <input
              id="officeName"
              name="officeName"
              defaultValue={sent?.officeName}
              placeholder="2º Ofício de Notas de Exemplo/RN"
              className={fieldClass(errors.officeName)}
            />
          </Field>
          <Field name="officeCity" label="Cidade" error={errors.officeCity}>
            <input
              id="officeCity"
              name="officeCity"
              defaultValue={sent?.officeCity}
              placeholder="Exemplo/RN"
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
                defaultValue={sent?.contactName}
                className={fieldClass(errors.contactName)}
              />
            </Field>
            <Field
              name="contactPhone"
              label="Telefone"
              error={errors.contactPhone}
            >
              <input
                id="contactPhone"
                name="contactPhone"
                type="tel"
                defaultValue={sent?.contactPhone}
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
                defaultValue={sent?.seats ?? "15"}
                className={fieldClass(errors.seats)}
              />
            </Field>
            <Field
              name="validDays"
              label="Validade (dias)"
              error={errors.validDays}
            >
              <input
                id="validDays"
                name="validDays"
                type="number"
                min={1}
                defaultValue={sent?.validDays ?? String(DEFAULT_COHORT_DAYS)}
                className={fieldClass(errors.validDays)}
              />
            </Field>
          </div>

          <FormError
            message={state.status === "error" ? state.message : undefined}
          />

          <button
            type="submit"
            disabled={pending}
            className="btn btn-admin-primary btn-lg"
          >
            {pending ? "Criando…" : "Criar turma"}
          </button>
        </form>
      )}
    </div>
  );
}
