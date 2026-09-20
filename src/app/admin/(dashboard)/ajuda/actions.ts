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
const UNKNOWN_VIDEO = "Este vídeo não está mais no catálogo.";
const GENERIC_ERROR = "Não foi possível salvar. Tente de novo.";

// Both actions are the person's own: no permission beyond a session, since
// every panel user may watch, and the row is keyed by their own id. Marking
// only takes a published video (the lib checks), so the table never holds
// a draft's id or a forged one.
async function setWatched(
  videoId: string,
  watched: boolean,
): Promise<ProgressState> {
  const session = await getSession();
  if (!session) return { status: "error", message: SESSION_ENDED };
  try {
    if (watched) {
      const accepted = await markWatched(session.user.id, videoId);
      if (!accepted) return { status: "error", message: UNKNOWN_VIDEO };
    } else {
      const tenant = await getTenant();
      await unmarkWatched(tenant.slug, session.user.id, videoId);
    }
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
