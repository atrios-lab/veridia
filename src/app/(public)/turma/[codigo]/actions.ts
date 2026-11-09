"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  cohortJoinSchema,
  normalizeCohortCode,
} from "@/core/cohorts/cohort.ts";
import { isCoursesTenant } from "@/core/tenant/courses-tenant.ts";
import { auth } from "@/lib/auth.ts";
import { joinCohort } from "@/lib/cohorts.ts";
import { isRateLimited } from "@/lib/rate-limit.ts";
import { getTenant } from "@/lib/tenant.ts";

export interface JoinValues {
  fullName: string;
  email: string;
  contactConsent: boolean;
}

export type JoinState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors: Record<string, string>;
      values: JoinValues;
      /** The link stopped taking sign-ups while the form was open. */
      closed?: boolean;
      /** The e-mail already has an account: the message points to the login. */
      emailTaken?: boolean;
    };

const CLOSED_MESSAGES = {
  "not-found": "Este link não existe mais. Peça um link novo a quem enviou.",
  closed: "Este link não aceita mais inscrições.",
  expired: "Este link não aceita mais inscrições.",
  full: "As vagas desta turma acabaram.",
} as const;

/**
 * A learner's sign-up through a cohort link: the account, the seat and the
 * membership in one go (see joinCohortWith), then the session, then the
 * course. Answers only on the courses office's host: anywhere else the page
 * is a 404 already, and the action refuses the same.
 */
export async function joinCohortAction(
  rawCode: string,
  _previous: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const values: JoinValues = {
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    contactConsent: formData.get("contactConsent") === "on",
  };
  const fail = (
    message: string,
    fieldErrors: Record<string, string> = {},
    extra: Partial<Extract<JoinState, { status: "error" }>> = {},
  ): JoinState => ({
    status: "error",
    message,
    fieldErrors,
    values,
    ...extra,
  });

  const requestHeaders = await headers();
  if (await isRateLimited(requestHeaders)) {
    return fail(
      "Muitas tentativas seguidas. Espere um minuto e tente de novo.",
    );
  }
  const tenant = await getTenant();
  const code = normalizeCohortCode(rawCode);
  if (!isCoursesTenant(tenant) || !code) {
    return fail(CLOSED_MESSAGES["not-found"], {}, { closed: true });
  }

  const parsed = cohortJoinSchema.safeParse({
    ...values,
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path.at(-1) ?? "");
      fieldErrors[field] ??= issue.message;
    }
    return fail("Confira os campos destacados.", fieldErrors);
  }

  const ctx = await auth.$context;
  const result = await joinCohort(code, parsed.data, {
    hashPassword: (password) => ctx.password.hash(password),
  });
  if (result.status === "refused") {
    if (result.reason === "email-taken") {
      return fail(
        "Confira os campos destacados.",
        { email: "Já existe uma conta com esse e-mail." },
        { emailTaken: true },
      );
    }
    return fail(CLOSED_MESSAGES[result.reason], {}, { closed: true });
  }

  try {
    await auth.api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password },
      headers: requestHeaders,
    });
  } catch {
    // The account exists; only the automatic sign-in failed. The login
    // page takes it from here with the same e-mail and password.
    redirect(
      `/admin/login?email=${encodeURIComponent(parsed.data.email)}&next=${encodeURIComponent(`/admin/ajuda/${result.courseSlug}`)}`,
    );
  }
  redirect(`/admin/ajuda/${encodeURIComponent(result.courseSlug)}`);
}
