"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  formatGuideNumber,
  GuideSchema,
  GuideSettingsSchema,
} from "@/core/guides/schema.ts";
import { db } from "@/db/index.ts";
import {
  type GuideAlertItem,
  guideAlertSnapshotWith,
  type RecordAlertChannel,
  type RecordAlertItem,
  recordAlertSnapshotWith,
} from "@/lib/guide-requests.ts";
import { findById } from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import {
  deleteGuide,
  findGuide,
  GuideNumberTakenError,
  issueGuide,
  renumberGuide,
  saveGuideSettingsWith,
  updateGuide,
} from "@/lib/tax-guides.ts";
import { getTenant } from "@/lib/tenant.ts";

export type GuideFormState =
  | { status: "idle" }
  | { status: "saved" }
  | {
      status: "error";
      message: string;
      /** "parties.0.name" -> message, as the schema's path reads. */
      fieldErrors: Record<string, string>;
    };

const NO_PERMISSION = "Você não tem permissão para emitir guias.";
const GENERIC = "Não foi possível salvar agora. Tente novamente.";

function errorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    fieldErrors[issue.path.map(String).join(".")] ??= issue.message;
  }
  return fieldErrors;
}

/**
 * Issues a guia (no id) or corrects one (with id). The whole guia travels as
 * one JSON field: parties are added and removed on the client, and the
 * schema here is the boundary, as in the holidays form.
 */
export async function saveGuide(
  _previous: GuideFormState,
  formData: FormData,
): Promise<GuideFormState> {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "requests.manage")) {
    return { status: "error", message: NO_PERMISSION, fieldErrors: {} };
  }
  const tenant = await getTenant();

  let submitted: unknown;
  try {
    submitted = JSON.parse(String(formData.get("guide") ?? "null"));
  } catch {
    submitted = null;
  }
  const parsed = GuideSchema.safeParse(submitted);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Confira os campos destacados.",
      fieldErrors: errorsOf(parsed.error.issues),
    };
  }

  const id = String(formData.get("id") ?? "");
  let target: string;
  try {
    if (id) {
      const updated = await updateGuide(
        tenant.slug,
        id,
        parsed.data,
        session.user.id,
      );
      if (!updated) {
        return {
          status: "error",
          message: "Guia não encontrada.",
          fieldErrors: {},
        };
      }
      target = updated.id;
    } else {
      const issued = await issueGuide(
        tenant.slug,
        parsed.data,
        session.user.id,
      );
      target = issued.id;
    }
  } catch (error) {
    console.error("guias.save", error);
    return { status: "error", message: GENERIC, fieldErrors: {} };
  }

  revalidatePath("/admin/utilitarios/guias");
  if (id) return { status: "saved" };
  redirect(`/admin/utilitarios/guias/${target}?emitida=1`);
}

export type GuideSettingsState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> };

/** The office's own laws, rates, addressees and signers for the guias. */
export async function saveGuideSettings(
  _previous: GuideSettingsState,
  formData: FormData,
): Promise<GuideSettingsState> {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "content.edit")) {
    return {
      status: "error",
      message: "Você não tem permissão para alterar estes dados.",
      fieldErrors: {},
    };
  }
  const tenant = await getTenant();

  let submitted: unknown;
  try {
    submitted = JSON.parse(String(formData.get("settings") ?? "null"));
  } catch {
    submitted = null;
  }
  const parsed = GuideSettingsSchema.safeParse(submitted);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Confira os campos destacados.",
      fieldErrors: errorsOf(parsed.error.issues),
    };
  }
  try {
    await saveGuideSettingsWith(db, tenant.slug, parsed.data, session.user.id);
  } catch {
    return { status: "error", message: GENERIC, fieldErrors: {} };
  }
  revalidatePath("/admin/utilitarios/guias");
  return { status: "saved" };
}

export type GuideNumberState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

/** The guia's number typed by hand: its order and its year. */
export async function renumberGuideAction(
  _previous: GuideNumberState,
  formData: FormData,
): Promise<GuideNumberState> {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "requests.manage")) {
    return { status: "error", message: NO_PERMISSION };
  }
  const tenant = await getTenant();
  const id = String(formData.get("id") ?? "");
  const sequence = Number(formData.get("sequence"));
  const year = Number(formData.get("year"));
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 99_999) {
    return {
      status: "error",
      message: "Informe o número de ordem (1 ou mais).",
    };
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { status: "error", message: "Informe o ano com quatro dígitos." };
  }
  try {
    const renumbered = await renumberGuide(
      tenant.slug,
      id,
      year,
      sequence,
      session.user.id,
    );
    if (!renumbered)
      return { status: "error", message: "Guia não encontrada." };
  } catch (error) {
    if (error instanceof GuideNumberTakenError) {
      return {
        status: "error",
        message: `Já existe outra guia com o número ${String(sequence).padStart(3, "0")}/${year}.`,
      };
    }
    return { status: "error", message: GENERIC };
  }
  revalidatePath("/admin/utilitarios/guias");
  return { status: "saved", message: "Número alterado." };
}

export type DeleteGuideState =
  | { status: "idle" }
  | { status: "error"; message: string };

/** "Excluir": out of the lists, the number free again; the record stays. */
export async function deleteGuideAction(
  _previous: DeleteGuideState,
  formData: FormData,
): Promise<DeleteGuideState> {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "requests.manage")) {
    return { status: "error", message: NO_PERMISSION };
  }
  const tenant = await getTenant();
  const id = String(formData.get("id") ?? "");
  // Read before: the guia's number and the citizen's request it came from.
  const guide = await findGuide(tenant.slug, id).catch(() => undefined);
  const deleted = await deleteGuide(tenant.slug, id, session.user.id).catch(
    () => false,
  );
  if (!deleted || !guide)
    return { status: "error", message: "Não foi possível excluir agora." };
  revalidatePath("/admin", "layout");
  const request = guide.serviceRequestId
    ? await findById(tenant.slug, guide.serviceRequestId).catch(() => undefined)
    : undefined;
  if (request) {
    // The request stays open without its guia: the office decides there
    // whether it was a test (Excluir protocolo) or a real one (another guia).
    redirect(
      `/admin/pedidos/${encodeURIComponent(request.protocolNumber)}?guia-excluida=${encodeURIComponent(formatGuideNumber(guide.year, guide.sequence))}`,
    );
  }
  redirect("/admin/utilitarios/guias?excluida=1");
}

/** The guia requests' news, polled by the panel's alert on every screen. */
export async function guideAlertSnapshotAction(): Promise<
  GuideAlertItem[] | null
> {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "requests.manage")) return null;
  try {
    const tenant = await getTenant();
    return await guideAlertSnapshotWith(db, tenant.slug);
  } catch (error) {
    console.error("guias.alert-snapshot", error);
    return null;
  }
}

/**
 * The other channels' news (new requests, LGPD, ouvidoria), for the panel's
 * alert: each channel only for whoever works it.
 */
export async function recordAlertSnapshotAction(): Promise<
  RecordAlertItem[] | null
> {
  const session = await getSession();
  if (!session) return null;
  const role = session.user.role ?? "";
  const channels: RecordAlertChannel[] = [
    ...(can(role, "requests.manage") ? (["pedidos"] as const) : []),
    ...(can(role, "channels.manage") ? (["lgpd", "ouvidoria"] as const) : []),
  ];
  if (channels.length === 0) return null;
  try {
    const tenant = await getTenant();
    return await recordAlertSnapshotWith(db, tenant.slug, channels);
  } catch (error) {
    console.error("alerts.record-snapshot", error);
    return null;
  }
}
