"use server";

import { revalidatePath } from "next/cache";
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
