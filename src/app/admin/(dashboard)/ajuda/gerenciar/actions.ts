"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import {
  assessmentSettingsSchema,
  questionFormSchema,
} from "@/core/courses/questions.ts";
import {
  type CourseFormInput,
  checkTutorialFile,
  courseFormSchema,
  describeTutorialFileProblem,
  isStoredTutorialUrl,
  MAX_SERVER_ACTION_BYTES,
  type TutorialFileKind,
  type TutorialFormInput,
  tutorialFormSchema,
} from "@/core/tutorials/video.ts";
import { db } from "@/db/index.ts";
import {
  createCourse,
  deleteCourse,
  moveCourse,
  PanelCourseError,
  SlugTakenError,
  setCoursePublished,
  updateCourse,
} from "@/lib/courses.ts";
import {
  createQuestionWith,
  deleteQuestionWith,
  setQuestionActiveWith,
  updateAssessmentSettingsWith,
  updateQuestionWith,
} from "@/lib/quiz.ts";
import { getSession } from "@/lib/session.ts";
import {
  createTutorial,
  deleteTutorial,
  FrameTakenError,
  moveTutorial,
  setTutorialPublished,
  updateTutorial,
} from "@/lib/tutorials.ts";
import {
  blobUploadEnabled,
  deleteTutorialFile,
  storeTutorialFile,
} from "@/lib/uploads.ts";
import { ADMIN_NAV } from "../../../_components/nav.ts";

// The platform account's actions on the tutorial catalog. Every one of them
// starts by asking for `tutorials.manage`, which the superadmin role alone
// holds: hiding the screen from everyone else is the courtesy, this is the
// gate. What they write reaches every office at once (once published), so
// nothing here touches the office of the session's host.

export type SaveTutorialState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> }
  | { status: "saved"; id: string };

export type TutorialActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done" };

const NOT_ALLOWED = "Você não tem acesso a esta ação.";
const GENERIC_ERROR =
  "Não foi possível salvar agora. Tente novamente em instantes.";
const NOT_FOUND = "Este vídeo não existe mais.";

const ROUTES = ADMIN_NAV.filter((item) => !item.external).map(
  (item) => item.href,
);
const FormSchema = tutorialFormSchema(ROUTES);

function revalidate(): void {
  revalidatePath("/admin/ajuda", "layout");
  revalidatePath("/admin");
}

async function requireManager(): Promise<string | null> {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "tutorials.manage")) {
    return null;
  }
  return session.user.id;
}

function fail(
  message: string,
  fieldErrors: Record<string, string> = {},
): SaveTutorialState {
  return { status: "error", message, fieldErrors };
}

/**
 * One uploaded file, however it arrived. With the store configured the
 * browser uploaded it already and sends the URL, which is only trusted
 * when it sits under the tutorial folder of this deploy's store: the token
 * route never issued a name anywhere else. Without the store the file
 * itself is in the form and goes to disk here.
 *
 * Returns the public URL to store, `null` for "no file sent", or a message
 * when the file was refused.
 */
async function resolveFile(
  formData: FormData,
  kind: TutorialFileKind,
): Promise<{ url: string | null } | { error: string }> {
  if (blobUploadEnabled()) {
    const url = String(formData.get(`${kind}Url`) ?? "");
    if (!url) return { url: null };
    if (!isStoredTutorialUrl(url, process.env.BLOB_PUBLIC_HOST)) {
      return { error: "Não foi possível confirmar o envio do arquivo." };
    }
    return { url };
  }

  const file = formData.get(kind);
  // An untouched file input arrives as an empty part: size is the signal.
  if (!(file instanceof File) || file.size === 0) return { url: null };
  const problem = checkTutorialFile(
    { mimeType: file.type, size: file.size },
    kind,
    MAX_SERVER_ACTION_BYTES[kind],
  );
  if (problem) return { error: describeTutorialFileProblem(problem, kind) };
  const bytes = Buffer.from(await file.arrayBuffer());
  return {
    url: await storeTutorialFile(bytes, kind, randomUUID(), file.type),
  };
}

function parseForm(
  formData: FormData,
): { input: TutorialFormInput } | { state: SaveTutorialState } {
  const duration = Number(formData.get("durationSeconds"));
  const parsed = FormSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    durationSeconds: Number.isFinite(duration) ? duration : Number.NaN,
    route: String(formData.get("route") ?? ""),
    trail: formData.get("trail") === "on",
    courseId: String(formData.get("courseId") ?? ""),
    kind: String(formData.get("kind") ?? ""),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { state: fail("Confira os campos destacados.", fieldErrors) };
  }
  return { input: parsed.data };
}

export async function saveTutorialAction(
  _previous: SaveTutorialState,
  formData: FormData,
): Promise<SaveTutorialState> {
  const actorId = await requireManager();
  if (!actorId) return fail(NOT_ALLOWED);

  const form = parseForm(formData);
  if ("state" in form) return form.state;
  const id = String(formData.get("id") ?? "");

  const video = await resolveFile(formData, "video");
  if ("error" in video) return fail(video.error, { video: video.error });
  const captions = await resolveFile(formData, "captions");
  if ("error" in captions) {
    return fail(captions.error, { captions: captions.error });
  }
  const removeCaptions = formData.get("removeCaptions") === "on";
  const poster = await resolveFile(formData, "poster");
  if ("error" in poster) return fail(poster.error, { poster: poster.error });
  const removePoster = formData.get("removePoster") === "on";

  try {
    if (!id) {
      if (!video.url) {
        return fail("Escolha o arquivo do vídeo.", {
          video: "Escolha o arquivo do vídeo.",
        });
      }
      const row = await createTutorial(
        randomUUID(),
        form.input,
        {
          videoUrl: video.url,
          captionsUrl: captions.url,
          posterUrl: poster.url,
        },
        actorId,
      );
      revalidate();
      return { status: "saved", id: row.id };
    }

    const result = await updateTutorial(
      id,
      form.input,
      {
        ...(video.url ? { videoUrl: video.url } : {}),
        ...(captions.url
          ? { captionsUrl: captions.url }
          : removeCaptions
            ? { captionsUrl: null }
            : {}),
        ...(poster.url
          ? { posterUrl: poster.url }
          : removePoster
            ? { posterUrl: null }
            : {}),
      },
      actorId,
    );
    if (!result) return fail(NOT_FOUND);
    // Only once the row points elsewhere: the store is cleaned last.
    for (const path of result.orphaned) await deleteTutorialFile(path);
    revalidate();
    return { status: "saved", id: result.row.id };
  } catch (error) {
    if (error instanceof FrameTakenError) {
      return fail(error.message, { kind: error.message });
    }
    console.error("treinamento.save", error);
    return fail(GENERIC_ERROR);
  }
}

async function simple(
  run: (actorId: string) => Promise<boolean>,
  logKey: string,
): Promise<TutorialActionState> {
  const actorId = await requireManager();
  if (!actorId) return { status: "error", message: NOT_ALLOWED };
  try {
    const found = await run(actorId);
    if (!found) return { status: "error", message: NOT_FOUND };
  } catch (error) {
    console.error(logKey, error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidate();
  return { status: "done" };
}

export async function publishTutorialAction(
  id: string,
): Promise<TutorialActionState> {
  return simple(
    (actorId) => setTutorialPublished(id, true, actorId),
    "treinamento.publish",
  );
}

export async function unpublishTutorialAction(
  id: string,
): Promise<TutorialActionState> {
  return simple(
    (actorId) => setTutorialPublished(id, false, actorId),
    "treinamento.unpublish",
  );
}

export async function moveTutorialAction(
  id: string,
  direction: "up" | "down",
): Promise<TutorialActionState> {
  const actorId = await requireManager();
  if (!actorId) return { status: "error", message: NOT_ALLOWED };
  try {
    // At either end there is no neighbour: not an error, nothing moved.
    await moveTutorial(id, direction, actorId);
  } catch (error) {
    console.error("treinamento.move", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidate();
  return { status: "done" };
}

/** Form-shaped, for `ConfirmAction`: the id rides in a hidden field. */
export async function deleteTutorialAction(
  _previous: TutorialActionState,
  formData: FormData,
): Promise<TutorialActionState> {
  const id = String(formData.get("id") ?? "");
  return simple(async (actorId) => {
    const orphaned = await deleteTutorial(id, actorId);
    if (!orphaned) return false;
    for (const path of orphaned) await deleteTutorialFile(path);
    return true;
  }, "treinamento.delete");
}

// Courses. Same gate, same audit slug, same rule for files: the row is
// written first and the store cleaned after.

function parseCourseForm(
  formData: FormData,
): { input: CourseFormInput } | { state: SaveTutorialState } {
  const parsed = courseFormSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    description: String(formData.get("description") ?? ""),
    sequential: formData.get("sequential") === "on",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { state: fail("Confira os campos destacados.", fieldErrors) };
  }
  return { input: parsed.data };
}

export async function saveCourseAction(
  _previous: SaveTutorialState,
  formData: FormData,
): Promise<SaveTutorialState> {
  const actorId = await requireManager();
  if (!actorId) return fail(NOT_ALLOWED);

  const form = parseCourseForm(formData);
  if ("state" in form) return form.state;
  const id = String(formData.get("id") ?? "");

  const poster = await resolveFile(formData, "poster");
  if ("error" in poster) return fail(poster.error, { poster: poster.error });
  const material = await resolveFile(formData, "material");
  if ("error" in material) {
    return fail(material.error, { material: material.error });
  }
  const removePoster = formData.get("removePoster") === "on";
  const removeMaterial = formData.get("removeMaterial") === "on";

  try {
    if (!id) {
      const row = await createCourse(
        form.input,
        { posterUrl: poster.url, materialUrl: material.url },
        actorId,
      );
      revalidate();
      return { status: "saved", id: row.id };
    }
    const result = await updateCourse(
      id,
      form.input,
      {
        ...(poster.url
          ? { posterUrl: poster.url }
          : removePoster
            ? { posterUrl: null }
            : {}),
        ...(material.url
          ? { materialUrl: material.url }
          : removeMaterial
            ? { materialUrl: null }
            : {}),
      },
      actorId,
    );
    if (!result) return fail("Este curso não existe mais.");
    for (const path of result.orphaned) await deleteTutorialFile(path);
    revalidate();
    return { status: "saved", id: result.row.id };
  } catch (error) {
    if (error instanceof SlugTakenError) {
      return fail(error.message, { slug: error.message });
    }
    if (error instanceof PanelCourseError) {
      return fail(error.message, { slug: error.message });
    }
    console.error("treinamento.course.save", error);
    return fail(GENERIC_ERROR);
  }
}

export async function publishCourseAction(
  id: string,
): Promise<TutorialActionState> {
  return simple(
    (actorId) => setCoursePublished(id, true, actorId),
    "treinamento.course.publish",
  );
}

export async function unpublishCourseAction(
  id: string,
): Promise<TutorialActionState> {
  return simple(
    (actorId) => setCoursePublished(id, false, actorId),
    "treinamento.course.unpublish",
  );
}

export async function moveCourseAction(
  id: string,
  direction: "up" | "down",
): Promise<TutorialActionState> {
  const actorId = await requireManager();
  if (!actorId) return { status: "error", message: NOT_ALLOWED };
  try {
    await moveCourse(id, direction, actorId);
  } catch (error) {
    console.error("treinamento.course.move", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidate();
  return { status: "done" };
}

/** Form-shaped, for `ConfirmAction`: the id rides in a hidden field. */
export async function deleteCourseAction(
  _previous: TutorialActionState,
  formData: FormData,
): Promise<TutorialActionState> {
  const actorId = await requireManager();
  if (!actorId) return { status: "error", message: NOT_ALLOWED };
  const id = String(formData.get("id") ?? "");
  try {
    const result = await deleteCourse(id, actorId);
    if (result.status === "has-videos") {
      return {
        status: "error",
        message:
          "O curso ainda tem vídeos. Mova-os para outro curso ou exclua antes.",
      };
    }
    if (result.status === "panel") {
      return {
        status: "error",
        message: "O curso do painel não pode ser excluído.",
      };
    }
    if (result.status === "not-found") {
      return { status: "error", message: "Este curso não existe mais." };
    }
    for (const path of result.orphaned) await deleteTutorialFile(path);
  } catch (error) {
    console.error("treinamento.course.delete", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidate();
  return { status: "done" };
}

// The assessment: settings and questions. Same gate, audited under the
// platform.

export async function saveAssessmentSettingsAction(
  courseId: string,
  _previous: SaveTutorialState,
  formData: FormData,
): Promise<SaveTutorialState> {
  const actorId = await requireManager();
  if (!actorId) return fail(NOT_ALLOWED);
  const hours = String(formData.get("workloadHours") ?? "").trim();
  const parsed = assessmentSettingsSchema.safeParse({
    passingScore: Number(formData.get("passingScore")),
    workloadHours: hours === "" ? null : Number(hours),
    retryHours: Number(formData.get("retryHours")),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return fail("Confira os campos destacados.", fieldErrors);
  }
  try {
    const saved = await updateAssessmentSettingsWith(
      db,
      courseId,
      parsed.data,
      actorId,
    );
    if (!saved) return fail("Este curso não existe mais.");
  } catch (error) {
    console.error("treinamento.assessment.settings", error);
    return fail(GENERIC_ERROR);
  }
  revalidate();
  return { status: "saved", id: courseId };
}

export async function saveQuestionAction(
  courseId: string,
  _previous: SaveTutorialState,
  formData: FormData,
): Promise<SaveTutorialState> {
  const actorId = await requireManager();
  if (!actorId) return fail(NOT_ALLOWED);
  const correct = formData.get("correctIndex");
  const parsed = questionFormSchema.safeParse({
    prompt: String(formData.get("prompt") ?? ""),
    options: [0, 1, 2, 3].map((i) => String(formData.get(`option${i}`) ?? "")),
    correctIndex: correct === null ? -1 : Number(correct),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return fail(
      parsed.error.issues[0]?.message ?? "Confira os campos destacados.",
      fieldErrors,
    );
  }
  const id = String(formData.get("id") ?? "");
  try {
    if (id) {
      const saved = await updateQuestionWith(db, id, parsed.data, actorId);
      if (!saved) return fail("Esta questão não existe mais.");
    } else {
      await createQuestionWith(db, courseId, parsed.data, actorId);
    }
  } catch (error) {
    console.error("treinamento.question.save", error);
    return fail(GENERIC_ERROR);
  }
  revalidate();
  return { status: "saved", id: id || courseId };
}

export async function setQuestionActiveAction(
  id: string,
  active: boolean,
): Promise<TutorialActionState> {
  return simple(
    (actorId) => setQuestionActiveWith(db, id, active, actorId),
    "treinamento.question.active",
  );
}

/** Form-shaped, for `ConfirmAction`: the id rides in a hidden field. */
export async function deleteQuestionAction(
  _previous: TutorialActionState,
  formData: FormData,
): Promise<TutorialActionState> {
  const actorId = await requireManager();
  if (!actorId) return { status: "error", message: NOT_ALLOWED };
  const id = String(formData.get("id") ?? "");
  try {
    const result = await deleteQuestionWith(db, id, actorId);
    if (result === "used") {
      return {
        status: "error",
        message:
          "Esta questão já apareceu numa tentativa e não pode ser excluída. Desative-a.",
      };
    }
    if (result === "not-found") {
      return { status: "error", message: "Esta questão não existe mais." };
    }
  } catch (error) {
    console.error("treinamento.question.delete", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidate();
  return { status: "done" };
}
