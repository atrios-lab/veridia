"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import { publicationFormSchema } from "@/core/publications/publication.ts";
import {
  archivePublication,
  createPublication,
  getPublication,
  updatePublication,
} from "@/lib/publications.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export type SaveState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> }
  | { status: "success" };

export type ArchiveState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

const NO_EDIT_PERMISSION = "Você não tem permissão para editar publicações.";
const NO_PUBLISH_PERMISSION =
  "Você pode salvar como rascunho, mas só quem tem permissão de publicar pode colocar isso no ar.";
const GENERIC_ERROR =
  "Não foi possível salvar agora. Tente novamente em instantes.";

function fieldErrorsOf(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    fieldErrors[field] ??= issue.message;
  }
  return fieldErrors;
}

/**
 * Creates or updates a publication, depending on whether `id` is present.
 * `content.edit` covers both — writing a draft, or editing one already on
 * the site. `content.publish` is required additionally, only at the instant
 * an entry date first appears where there was none before: that is the act
 * of publishing, the one thing staff cannot do (see design.md, "content.edit
 * rascunha, content.publish publica").
 */
export async function savePublication(
  _previous: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "content.edit")) {
    return { status: "error", message: NO_EDIT_PERMISSION, fieldErrors: {} };
  }

  const id = String(formData.get("id") ?? "").trim() || undefined;
  // "Salvar rascunho" always lands as a draft, whatever the date fields hold:
  // it is the button that lets an operator prepare text and dates without
  // going live yet, and re-typing dates just to clear them would be a worse
  // interface than the button simply meaning what it says.
  const isDraftIntent = formData.get("intent") === "draft";
  const publishAt = isDraftIntent
    ? ""
    : String(formData.get("publishAt") ?? "").trim();
  const expireAt = isDraftIntent
    ? ""
    : String(formData.get("expireAt") ?? "").trim();

  const parsed = publicationFormSchema.safeParse({
    kind: formData.get("kind"),
    title: formData.get("title"),
    body: formData.get("body"),
    publishAt: publishAt || undefined,
    expireAt: expireAt || undefined,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Confira os campos destacados.",
      fieldErrors: fieldErrorsOf(parsed.error),
    };
  }

  const tenant = await getTenant();
  const existing = id ? await getPublication(tenant.slug, id) : undefined;
  const isFirstPublish = !existing?.publishAt && Boolean(parsed.data.publishAt);
  if (isFirstPublish && !can(session.user.role ?? "", "content.publish")) {
    return {
      status: "error",
      message: NO_PUBLISH_PERMISSION,
      fieldErrors: {},
    };
  }

  try {
    if (existing) {
      await updatePublication(
        tenant.slug,
        existing.id,
        parsed.data,
        session.user.id,
      );
    } else {
      await createPublication(tenant.slug, parsed.data, session.user.id);
    }
  } catch (error) {
    console.error("publicacoes.save", error);
    return { status: "error", message: GENERIC_ERROR, fieldErrors: {} };
  }
  revalidatePath("/admin/publicacoes");
  revalidatePath("/");
  return { status: "success" };
}

export async function archivePublicationAction(
  _previous: ArchiveState,
  formData: FormData,
): Promise<ArchiveState> {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "content.edit")) {
    return { status: "error", message: NO_EDIT_PERMISSION };
  }

  const id = String(formData.get("id") ?? "");
  const tenant = await getTenant();
  try {
    await archivePublication(tenant.slug, id, session.user.id);
  } catch (error) {
    console.error("publicacoes.archive", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/admin/publicacoes");
  revalidatePath("/");
  return { status: "success" };
}
