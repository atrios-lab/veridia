"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import {
  checkTutorialFile,
  describeTutorialFileProblem,
  isStoredTutorialUrl,
  MAX_CAPTIONS_BYTES,
  MAX_VIDEO_BYTES_SERVER_ACTION,
  type TutorialFileKind,
  type TutorialFormInput,
  tutorialFormSchema,
} from "@/core/tutorials/video.ts";
import { getSession } from "@/lib/session.ts";
import {
  createTutorial,
  deleteTutorial,
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
  revalidatePath("/admin/ajuda/gerenciar");
  revalidatePath("/admin/ajuda");
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
    kind === "video" ? MAX_VIDEO_BYTES_SERVER_ACTION : MAX_CAPTIONS_BYTES,
  );
  if (problem) return { error: describeTutorialFileProblem(problem, kind) };
  const bytes = Buffer.from(await file.arrayBuffer());
  return { url: await storeTutorialFile(bytes, kind, randomUUID()) };
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
        { videoUrl: video.url, captionsUrl: captions.url },
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
      },
      actorId,
    );
    if (!result) return fail(NOT_FOUND);
    // Only once the row points elsewhere: the store is cleaned last.
    for (const path of result.orphaned) await deleteTutorialFile(path);
    revalidate();
    return { status: "saved", id: result.row.id };
  } catch (error) {
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
