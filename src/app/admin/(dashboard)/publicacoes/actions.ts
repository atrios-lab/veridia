"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { attachmentAvailableUntil } from "@/core/publications/attachment-retention.ts";
import { publicationFormSchema } from "@/core/publications/publication.ts";
import { noticeSectors } from "@/core/tenant/gating.ts";
import { notifyIndexNow } from "@/lib/notify-indexnow.ts";
import {
  archivePublication,
  createPublication,
  deletePublication,
  getPublication,
  updatePublication,
} from "@/lib/publications.ts";
import { getSession } from "@/lib/session.ts";
import { getSiteOrigin } from "@/lib/site-origin.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import {
  AttachmentError,
  collectAttachments,
  deleteStoredFile,
} from "@/lib/uploads.ts";

export type SaveState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> }
  | {
      status: "success";
      /** The last day the file just sent is kept (30-day rule), if one was. */
      fileUntil?: string;
    };

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
 * `content.edit` covers both: writing a draft, or editing one already on
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
  if (
    !session ||
    !can(session.user.role ?? "", "content.edit", session.user.permissions)
  ) {
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

  const tenant = await getTenant();
  // The factory takes what this office's attributions allow: hiding an
  // option in the form is not what enforces it.
  const parsed = publicationFormSchema(noticeSectors(tenant)).safeParse({
    kind: formData.get("kind"),
    sector: String(formData.get("sector") ?? "").trim() || undefined,
    noticeType: String(formData.get("noticeType") ?? "").trim() || undefined,
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

  const existing = id ? await getPublication(tenant.slug, id) : undefined;
  const isFirstPublish = !existing?.publishAt && Boolean(parsed.data.publishAt);
  if (
    isFirstPublish &&
    !can(session.user.role ?? "", "content.publish", session.user.permissions)
  ) {
    return {
      status: "error",
      message: NO_PUBLISH_PERMISSION,
      fieldErrors: {},
    };
  }

  let fileUntil: string | undefined;
  try {
    // One document per publication. In the deploy the browser has already
    // sent it straight to the Blob store and this receives a reference: a
    // function's request body is capped around 4.5 MB, below a phone photo
    // or a scanned PDF, which is why attachments used to vanish on publish.
    // In development the file itself comes in the body. Either way the
    // shared type and size limits apply.
    const [stored] = await collectAttachments(formData, "arquivo", {
      tenantSlug: tenant.slug,
      kind: "edital",
      limit: 1,
    });
    if (stored) fileUntil = attachmentAvailableUntil(today());

    if (existing) {
      await updatePublication(
        tenant.slug,
        existing.id,
        parsed.data,
        session.user.id,
        stored,
      );
      // Only after the row points at the new file: losing the old one while
      // the row still references it would leave a broken link instead of a
      // missing extra.
      if (stored && existing.attachmentPath) {
        await deleteStoredFile(existing.attachmentPath);
      }
    } else {
      await createPublication(
        tenant.slug,
        parsed.data,
        session.user.id,
        stored,
      );
    }
  } catch (error) {
    if (error instanceof AttachmentError) {
      return { status: "error", message: error.message, fieldErrors: {} };
    }
    console.error("publicacoes.save", error);
    return { status: "error", message: GENERIC_ERROR, fieldErrors: {} };
  }
  revalidatePath("/admin/publicacoes");
  revalidatePath("/");
  // Bing, Yandex and Naver read IndexNow; Google does not and is unaffected.
  // Only on the instant this notice actually goes live, matching the
  // permission check above, not on every edit of an already-published one.
  if (isFirstPublish) notifyIndexNow(await getSiteOrigin(), ["/editais"]);
  return { status: "success", fileUntil };
}

export type DeleteState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

const NO_DELETE_PERMISSION =
  "Só quem tem permissão de publicar pode excluir uma publicação que já foi ao ar.";

/**
 * Deletes a publication for good, for the one made by mistake. A draft
 * needs only `content.edit`, like writing it did; anything that has been
 * published (an entry date was set) needs `content.publish`, the same
 * permission that put it on the site.
 */
export async function deletePublicationAction(
  _previous: DeleteState,
  formData: FormData,
): Promise<DeleteState> {
  const session = await getSession();
  const role = session?.user.role ?? "";
  const granted = session?.user.permissions;
  if (!session || !can(role, "content.edit", granted)) {
    return { status: "error", message: NO_EDIT_PERMISSION };
  }

  const id = String(formData.get("id") ?? "");
  const tenant = await getTenant();
  try {
    const existing = await getPublication(tenant.slug, id);
    if (!existing) return { status: "success" };
    if (existing.publishAt && !can(role, "content.publish", granted)) {
      return { status: "error", message: NO_DELETE_PERMISSION };
    }
    const deleted = await deletePublication(tenant.slug, id, session.user.id);
    if (deleted?.attachmentPath) await deleteStoredFile(deleted.attachmentPath);
  } catch (error) {
    console.error("publicacoes.delete", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/admin/publicacoes");
  revalidatePath("/");
  revalidatePath("/editais");
  // From the detail page there is nothing left to show: go back to the
  // list in the same response, before that page re-renders as a 404. Only
  // the panel's own publications list is accepted as a destination.
  const redirectTo = String(formData.get("redirectTo") ?? "");
  if (/^\/admin\/publicacoes(\?aba=[a-z-]+)?$/.test(redirectTo)) {
    redirect(redirectTo);
  }
  return { status: "success" };
}

export async function archivePublicationAction(
  _previous: ArchiveState,
  formData: FormData,
): Promise<ArchiveState> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "content.edit", session.user.permissions)
  ) {
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
