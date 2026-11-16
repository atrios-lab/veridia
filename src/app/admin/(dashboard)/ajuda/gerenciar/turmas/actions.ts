"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  cohortCreateSchema,
  cohortUpdateSchema,
} from "@/core/cohorts/cohort.ts";
import { justify } from "@/lib/audit-reason.ts";
import {
  CohortCourseError,
  createCohort,
  deleteCohort,
  setCohortClosed,
  updateCohort,
} from "@/lib/cohorts.ts";
import { getSession } from "@/lib/session.ts";
import { today } from "@/lib/tenant.ts";
import { COHORTS_PATH, cohortPath } from "./paths.ts";

export type CohortFormState =
  | { status: "idle" }
  | { status: "saved" }
  | {
      status: "error";
      message: string;
      fieldErrors: Record<string, string>;
      values: Record<string, string>;
    };

/** The platform account, or null: every action here starts with it. */
async function platformActor(): Promise<string | null> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "cohorts.manage", session.user.permissions)
  )
    return null;
  return session.user.id;
}

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    fieldErrors[String(issue.path.at(-1) ?? "")] ??= issue.message;
  }
  return fieldErrors;
}

function valuesOf(formData: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(
    keys.map((key) => [key, String(formData.get(key) ?? "")]),
  );
}

const CREATE_KEYS = [
  "courseId",
  "officeName",
  "officeCity",
  "contactName",
  "contactPhone",
  "seats",
  "validDays",
];

export async function createCohortAction(
  _previous: CohortFormState,
  formData: FormData,
): Promise<CohortFormState> {
  const values = valuesOf(formData, CREATE_KEYS);
  const actorId = await platformActor();
  if (!actorId) {
    return {
      status: "error",
      message: "Você não tem permissão para criar turmas.",
      fieldErrors: {},
      values,
    };
  }
  const parsed = cohortCreateSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Confira os campos destacados.",
      fieldErrors: fieldErrorsOf(parsed.error.issues),
      values,
    };
  }
  let id: string;
  try {
    const cohort = await createCohort(
      parsed.data,
      actorId,
      randomBytes,
      today(),
    );
    id = cohort.id;
  } catch (error) {
    if (error instanceof CohortCourseError) {
      return {
        status: "error",
        message: "Confira os campos destacados.",
        fieldErrors: { courseId: "Esse curso não emite certificado." },
        values,
      };
    }
    throw error;
  }
  revalidatePath(COHORTS_PATH);
  redirect(cohortPath(id));
}

const UPDATE_KEYS = [
  "officeName",
  "officeCity",
  "contactName",
  "contactPhone",
  "seats",
  "lastDay",
];

export async function updateCohortAction(
  cohortId: string,
  _previous: CohortFormState,
  formData: FormData,
): Promise<CohortFormState> {
  const values = valuesOf(formData, UPDATE_KEYS);
  const actorId = await platformActor();
  if (!actorId) {
    return {
      status: "error",
      message: "Você não tem permissão para alterar turmas.",
      fieldErrors: {},
      values,
    };
  }
  const parsed = cohortUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Confira os campos destacados.",
      fieldErrors: fieldErrorsOf(parsed.error.issues),
      values,
    };
  }
  const result = await updateCohort(cohortId, parsed.data, actorId);
  if (result.status === "not-found") {
    return {
      status: "error",
      message: "Essa turma não existe mais.",
      fieldErrors: {},
      values,
    };
  }
  if (result.status === "seats-below-members") {
    return {
      status: "error",
      message: "Confira os campos destacados.",
      fieldErrors: {
        seats: `A turma já tem ${result.members} ${result.members === 1 ? "participante" : "participantes"}: as vagas não podem ficar abaixo disso.`,
      },
      values,
    };
  }
  revalidatePath(COHORTS_PATH);
  revalidatePath(cohortPath(cohortId));
  return { status: "saved" };
}

/** Closes the link, or opens it again. A plain form post: no state to show
 * besides the page itself, which revalidates. */
export async function setCohortClosedAction(
  cohortId: string,
  closed: boolean,
): Promise<void> {
  const actorId = await platformActor();
  if (!actorId) return;
  await setCohortClosed(cohortId, closed, actorId);
  revalidatePath(COHORTS_PATH);
  revalidatePath(cohortPath(cohortId));
}

export type CohortDeleteState =
  | { status: "idle" }
  | { status: "error"; message: string };

/**
 * ⚠️ Deletes a cohort nobody joined (lib/cohorts.ts, deleteCohortWith),
 * with the reason for the audit, then back to the list. A cohort with
 * learners is refused here as there, and the message points to closing it.
 */
export async function deleteCohortAction(
  cohortId: string,
  _previous: CohortDeleteState,
  formData: FormData,
): Promise<CohortDeleteState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const actorId = await platformActor();
  if (!actorId) {
    return {
      status: "error",
      message: "Você não tem permissão para excluir turmas.",
    };
  }
  const result = await deleteCohort(cohortId, actorId);
  if (result.status === "not-found") {
    return { status: "error", message: "Essa turma não existe mais." };
  }
  if (result.status === "has-members") {
    return {
      status: "error",
      message: `A turma já tem ${result.members} ${result.members === 1 ? "participante" : "participantes"} e não pode ser excluída. Use "Encerrar inscrições" para parar o link.`,
    };
  }
  revalidatePath(COHORTS_PATH);
  redirect(COHORTS_PATH);
}
