"use server";

import { revalidatePath } from "next/cache";
import { TUTORIALS } from "@/core/tutorials/catalog.ts";
import { isTutorialId } from "@/core/tutorials/progress.ts";
import { getSession } from "@/lib/session.ts";
import { markWatched, unmarkWatched } from "@/lib/tutorials.ts";

export type ProgressState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; watched: boolean };

const SESSION_ENDED = "Sua sessão terminou. Entre de novo para continuar.";
const UNKNOWN_VIDEO = "Este vídeo não está mais no catálogo.";
const GENERIC_ERROR = "Não foi possível salvar. Tente de novo.";

// Both actions are the person's own: no permission beyond a session, since
// every panel user may watch, and the row is keyed by their own id. The id
// is checked against the catalog so the table only ever holds slugs the
// panel can show; anything else is a forged submission.
async function setWatched(
  videoId: string,
  watched: boolean,
): Promise<ProgressState> {
  const session = await getSession();
  if (!session) return { status: "error", message: SESSION_ENDED };
  if (!isTutorialId(TUTORIALS, videoId)) {
    return { status: "error", message: UNKNOWN_VIDEO };
  }
  try {
    if (watched) await markWatched(session.user.id, videoId);
    else await unmarkWatched(session.user.id, videoId);
  } catch (error) {
    console.error("ajuda.progress", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  // The list's tick and the overview's trail card both read this.
  revalidatePath("/admin/ajuda");
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
