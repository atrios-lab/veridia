"use server";

import { randomBytes, randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { certificateRequestSchema } from "@/core/courses/certificate.ts";
import { db } from "@/db/index.ts";
import { issueCertificate } from "@/lib/certificates.ts";
import { startAttemptWith, submitAttemptWith } from "@/lib/quiz.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { markWatched, unmarkWatched } from "@/lib/tutorials.ts";

export type ProgressState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; watched: boolean };

const SESSION_ENDED = "Sua sessão terminou. Entre de novo para continuar.";
const UNAVAILABLE_VIDEO =
  "Este vídeo não está disponível agora. Assista aos anteriores do curso.";
const LESSON_STAYS = "Aulas de curso em sequência não podem ser desmarcadas.";
const GENERIC_ERROR = "Não foi possível salvar. Tente de novo.";

// Both actions are the person's own: no permission beyond a session, since
// every panel user may watch, and the row is keyed by their own id. Marking
// only takes a published video of a published course, and in a sequential
// course only an open one (the lib checks), so the table never holds a
// draft's id, a forged one or a skipped lesson.
async function setWatched(
  videoId: string,
  watched: boolean,
): Promise<ProgressState> {
  const session = await getSession();
  if (!session) return { status: "error", message: SESSION_ENDED };
  try {
    if (watched) {
      const accepted = await markWatched(session.user.id, videoId);
      if (!accepted) return { status: "error", message: UNAVAILABLE_VIDEO };
    } else {
      const tenant = await getTenant();
      const undone = await unmarkWatched(tenant.slug, session.user.id, videoId);
      if (!undone) return { status: "error", message: LESSON_STAYS };
    }
  } catch (error) {
    console.error("ajuda.progress", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  // The catalog, every course page and the overview's trail card read this.
  revalidatePath("/admin/ajuda", "layout");
  revalidatePath("/admin");
  return { status: "success", watched };
}

export async function markTutorialWatchedAction(
  videoId: string,
): Promise<ProgressState> {
  return setWatched(videoId, true);
}

export async function unmarkTutorialWatchedAction(
  videoId: string,
): Promise<ProgressState> {
  return setWatched(videoId, false);
}

// The assessment and the certificate: the person's own acts, a session and
// nothing more. Every rule (all videos watched, the wait, a pass before a
// certificate) is the lib's, checked again here whatever the page showed.

export type AttemptActionState =
  | { status: "error"; message: string }
  | { status: "started" }
  | { status: "graded"; correct: number; total: number; passed: boolean };

const ATTEMPT_REFUSED: Record<string, string> = {
  "no-assessment": "Este curso não tem avaliação.",
  "videos-left": "Assista a todos os vídeos do curso antes da avaliação.",
  passed: "Você já foi aprovado nesta avaliação.",
  wait: "A próxima tentativa ainda não está liberada.",
  "not-found": "Esta tentativa não existe mais.",
  submitted: "Esta tentativa já foi enviada.",
  incomplete: "Responda a todas as questões antes de enviar.",
};

export async function startAttemptAction(
  courseId: string,
): Promise<AttemptActionState> {
  const session = await getSession();
  if (!session) return { status: "error", message: SESSION_ENDED };
  try {
    const result = await startAttemptWith(
      db,
      session.user.id,
      courseId,
      randomInt,
      new Date(),
    );
    if (result.status === "refused") {
      return { status: "error", message: ATTEMPT_REFUSED[result.reason] };
    }
  } catch (error) {
    console.error("ajuda.attempt.start", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/admin/ajuda", "layout");
  return { status: "started" };
}

/** `picks` are positions in the alternatives as shown, one per question in
 * the order shown; the lib maps them back and grades on the server. */
export async function submitAttemptAction(
  attemptId: string,
  picks: (number | null)[],
): Promise<AttemptActionState> {
  const session = await getSession();
  if (!session) return { status: "error", message: SESSION_ENDED };
  try {
    const result = await submitAttemptWith(
      db,
      session.user.id,
      attemptId,
      picks,
      new Date(),
    );
    if (result.status === "refused") {
      return { status: "error", message: ATTEMPT_REFUSED[result.reason] };
    }
    revalidatePath("/admin/ajuda", "layout");
    return {
      status: "graded",
      correct: result.grade.correct,
      total: result.grade.total,
      passed: result.grade.passed,
    };
  } catch (error) {
    console.error("ajuda.attempt.submit", error);
    return { status: "error", message: GENERIC_ERROR };
  }
}

export type IssueActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> }
  | { status: "issued"; code: string };

const ISSUE_REFUSED: Record<string, string> = {
  "not-passed": "O certificado é emitido depois da aprovação na avaliação.",
  "already-issued": "O seu certificado deste curso já foi emitido.",
  "no-certificate": "Este curso não emite certificado.",
};

export async function issueCertificateAction(
  courseId: string,
  _previous: IssueActionState,
  formData: FormData,
): Promise<IssueActionState> {
  const session = await getSession();
  if (!session) {
    return { status: "error", message: SESSION_ENDED, fieldErrors: {} };
  }
  const parsed = certificateRequestSchema.safeParse({
    fullName: String(formData.get("fullName") ?? ""),
    cpf: String(formData.get("cpf") ?? ""),
    roleTitle: String(formData.get("roleTitle") ?? ""),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return {
      status: "error",
      message: "Confira os campos destacados.",
      fieldErrors,
    };
  }
  try {
    const tenant = await getTenant();
    const host = (await headers()).get("host") ?? tenant.hosts[0] ?? "";
    const result = await issueCertificate(
      {
        userId: session.user.id,
        courseId,
        tenantSlug: tenant.slug,
        tenantName: tenant.name,
        host,
      },
      parsed.data,
      (size) => randomBytes(size),
    );
    if (result.status === "refused") {
      return {
        status: "error",
        message: ISSUE_REFUSED[result.reason],
        fieldErrors: {},
      };
    }
    revalidatePath("/admin/ajuda", "layout");
    return { status: "issued", code: result.certificate.code };
  } catch (error) {
    console.error("ajuda.certificate.issue", error);
    return { status: "error", message: GENERIC_ERROR, fieldErrors: {} };
  }
}
