"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import { OfficeBulletinSchema } from "@/core/tenant/overrides.ts";
import {
  fundFieldName,
  isBulletinStatus,
  parseBulletinFigures,
} from "@/core/transparency/bulletin.ts";
import {
  canPublish,
  canUnpublish,
  type DocumentStatus,
  documentFormSchema,
} from "@/core/transparency/documents.ts";
import { FUNDS_BY_STATE } from "@/core/transparency/rubrics.ts";
import { notifyIndexNow } from "@/lib/notify-indexnow.ts";
import { getSession } from "@/lib/session.ts";
import { getSiteOrigin } from "@/lib/site-origin.ts";
import { getTenant } from "@/lib/tenant.ts";
import {
  createDocument,
  deleteDocument,
  getDocument,
  moveDocument,
  publishDocument,
  saveBulletinOption,
  unpublishDocument,
  upsertBulletin,
} from "@/lib/transparency.ts";
import {
  AttachmentError,
  deleteStoredFile,
  storeAttachments,
} from "@/lib/uploads.ts";

export type SaveState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> }
  | { status: "success" };

export type ActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

const NO_PERMISSION = "Você não tem permissão para gerir a transparência.";
const GENERIC_ERROR =
  "Não foi possível concluir agora. Tente novamente em instantes.";

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

function revalidate(): void {
  revalidatePath("/admin/transparencia");
  revalidatePath("/transparencia");
}

/** Every action here needs the same gate; this returns the session or null. */
async function authorize() {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "content.edit")) return null;
  return session;
}

// ── Documents ──────────────────────────────────────────────────────────────

/** Uploads a document; it always lands as a draft (see the spec). */
export async function uploadDocumentAction(
  _previous: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const session = await authorize();
  if (!session) {
    return { status: "error", message: NO_PERMISSION, fieldErrors: {} };
  }

  const parsed = documentFormSchema.safeParse({
    category: String(formData.get("category") ?? ""),
    title: formData.get("title"),
    yearLabel: formData.get("yearLabel"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Confira os campos destacados.",
      fieldErrors: fieldErrorsOf(parsed.error),
    };
  }

  const chosen = formData
    .getAll("arquivo")
    .filter((f): f is File => f instanceof File && f.size > 0);
  const file = chosen[0];
  if (!file) {
    return {
      status: "error",
      message: "Escolha o PDF do documento.",
      fieldErrors: { arquivo: "Escolha um arquivo." },
    };
  }
  // PDF only: a transparency document is a document, not a photo. The shared
  // `storeAttachments` also allows images, so the narrowing is here.
  if (file.type !== "application/pdf") {
    return {
      status: "error",
      message: "O documento tem de ser um PDF.",
      fieldErrors: { arquivo: "Só PDF." },
    };
  }

  const tenant = await getTenant();
  try {
    const [stored] = await storeAttachments([file], {
      tenantSlug: tenant.slug,
      kind: "documento",
    });
    if (!stored) {
      return {
        status: "error",
        message: "Escolha o PDF do documento.",
        fieldErrors: { arquivo: "Escolha um arquivo." },
      };
    }
    await createDocument(tenant.slug, parsed.data, stored, session.user.id);
  } catch (error) {
    if (error instanceof AttachmentError) {
      return { status: "error", message: error.message, fieldErrors: {} };
    }
    console.error("transparencia.upload", error);
    return { status: "error", message: GENERIC_ERROR, fieldErrors: {} };
  }
  revalidate();
  return { status: "success" };
}

export async function publishDocumentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const id = String(formData.get("id") ?? "");
  const tenant = await getTenant();
  try {
    const doc = await getDocument(tenant.slug, id);
    if (!doc) return { status: "error", message: "Documento não encontrado." };
    if (canPublish(doc.status as DocumentStatus)) {
      await publishDocument(tenant.slug, id, session.user.id);
      notifyIndexNow(await getSiteOrigin(), ["/transparencia"]);
    }
  } catch (error) {
    console.error("transparencia.publish", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidate();
  return { status: "success" };
}

export async function unpublishDocumentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const id = String(formData.get("id") ?? "");
  const tenant = await getTenant();
  try {
    const doc = await getDocument(tenant.slug, id);
    if (!doc) return { status: "error", message: "Documento não encontrado." };
    if (canUnpublish(doc.status as DocumentStatus)) {
      await unpublishDocument(tenant.slug, id, session.user.id);
    }
  } catch (error) {
    console.error("transparencia.unpublish", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidate();
  return { status: "success" };
}

export async function moveDocumentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const id = String(formData.get("id") ?? "");
  const direction = formData.get("direction") === "up" ? "up" : "down";
  const tenant = await getTenant();
  try {
    await moveDocument(tenant.slug, id, direction);
  } catch (error) {
    console.error("transparencia.move", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidate();
  return { status: "success" };
}

export async function deleteDocumentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const id = String(formData.get("id") ?? "");
  const tenant = await getTenant();
  try {
    const deleted = await deleteDocument(tenant.slug, id, session.user.id);
    if (deleted) await deleteStoredFile(deleted.filePath);
  } catch (error) {
    console.error("transparencia.delete", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidate();
  return { status: "success" };
}

// ── Bulletin ─────────────────────────────────────────────────────────────────

export async function publishBulletinAction(
  _previous: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const session = await authorize();
  if (!session) {
    return { status: "error", message: NO_PERMISSION, fieldErrors: {} };
  }

  const month = Number(formData.get("month"));
  const year = Number(formData.get("year"));
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return {
      status: "error",
      message: "Escolha o mês.",
      fieldErrors: { month: "Mês inválido." },
    };
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return {
      status: "error",
      message: "Informe o ano.",
      fieldErrors: { year: "Ano inválido." },
    };
  }

  // The office decides which funds the form carries (its state's) and
  // whether gross revenue and expenses are read at all: with the option off,
  // whatever those fields hold is never parsed, so it cannot reach the row.
  const tenant = await getTenant();
  const state = tenant.location.state;
  const funds: Record<string, string> = {};
  for (const fund of FUNDS_BY_STATE[state]) {
    funds[fund.key] = String(formData.get(fundFieldName(fund.key)) ?? "");
  }
  const parsedFigures = parseBulletinFigures(
    state,
    {
      actsCount: String(formData.get("actsCount") ?? ""),
      funds,
      iss: String(formData.get("iss") ?? ""),
      grossRevenue: String(formData.get("grossRevenue") ?? ""),
      expenses: String(formData.get("expenses") ?? ""),
    },
    { privateFigures: tenant.publishBulletinPrivateFigures },
  );
  if ("fieldErrors" in parsedFigures) {
    return {
      status: "error",
      message: "Confira os valores destacados.",
      fieldErrors: parsedFigures.fieldErrors,
    };
  }

  const statusRaw = String(formData.get("bulletinStatus") ?? "preliminary");
  const status = isBulletinStatus(statusRaw) ? statusRaw : "preliminary";

  try {
    await upsertBulletin(
      tenant.slug,
      {
        // First day of the month, zero-padded: the column is a date.
        referenceMonth: `${year}-${String(month).padStart(2, "0")}-01`,
        figures: parsedFigures.figures,
        status,
      },
      session.user.id,
    );
  } catch (error) {
    console.error("transparencia.bulletin", error);
    return { status: "error", message: GENERIC_ERROR, fieldErrors: {} };
  }
  revalidate();
  notifyIndexNow(await getSiteOrigin(), ["/transparencia"]);
  return { status: "success" };
}

/**
 * Whether the office's bulletins also show gross revenue, expenses and the
 * balance. Applies to every month at once, published ones included, because
 * the PDF is drawn on each request with the option as it stands.
 */
export async function saveBulletinOptionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const parsed = OfficeBulletinSchema.safeParse({
    publishBulletinPrivateFigures:
      formData.get("publishBulletinPrivateFigures") === "true",
  });
  if (!parsed.success) return { status: "error", message: GENERIC_ERROR };

  const tenant = await getTenant();
  try {
    await saveBulletinOption(
      tenant.slug,
      parsed.data.publishBulletinPrivateFigures,
      session.user.id,
    );
  } catch (error) {
    console.error("transparencia.bulletin-option", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidate();
  return { status: "success" };
}
