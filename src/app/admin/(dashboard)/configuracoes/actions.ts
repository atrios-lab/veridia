"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import {
  OfficeContactSchema,
  OfficeDeadlineSchema,
} from "@/core/tenant/overrides.ts";
import { db } from "@/db/index.ts";
import { tenantContent } from "@/db/schema.ts";
import { recordAudit } from "@/lib/audit.ts";
import { getSession } from "@/lib/session.ts";
import {
  getTenant,
  OFFICE_CONTACT_KEY,
  OFFICE_DEADLINE_KEY,
} from "@/lib/tenant.ts";

/** The four fields as they were typed, unvalidated. */
export type OfficeContactValues = Record<
  "openingHours" | "phone" | "whatsapp" | "email",
  string
>;

export type OfficeContactState =
  | { status: "idle" }
  | { status: "saved" }
  | {
      status: "error";
      message: string;
      fieldErrors: Record<string, string>;
      // Echoed back because React resets an uncontrolled form once the action
      // resolves. Without this the registrar loses three correct fields to
      // fix the fourth, which is how a form teaches people to distrust it.
      values: OfficeContactValues;
    };

const GENERIC_ERROR =
  "Não foi possível salvar agora. Tente novamente em instantes.";

function fail(
  message: string,
  values: OfficeContactValues,
  fieldErrors: Record<string, string> = {},
): OfficeContactState {
  return { status: "error", message, fieldErrors, values };
}

export async function saveOfficeContact(
  _previous: OfficeContactState,
  formData: FormData,
): Promise<OfficeContactState> {
  // Only these four names are ever read. Name, CNS and attributions are not
  // in the shape, so a forged submission carrying them changes nothing: there
  // is no defensive branch to forget, the schema is the boundary.
  const values: OfficeContactValues = {
    openingHours: String(formData.get("openingHours") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    whatsapp: String(formData.get("whatsapp") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
  };

  const session = await getSession();
  // Hiding the screen is not the check; this is. A person who reaches the
  // action by any other route is refused here, on the server.
  if (!session || !can(session.user.role ?? "", "content.edit")) {
    return fail("Você não tem permissão para alterar estes dados.", values);
  }
  const tenant = await getTenant();

  const parsed = OfficeContactSchema.safeParse({
    openingHours: values.openingHours,
    contacts: {
      phone: values.phone,
      whatsapp: values.whatsapp,
      email: values.email,
    },
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      // "contacts.phone" -> "phone": the form names its inputs flat.
      const field = String(issue.path.at(-1) ?? "");
      fieldErrors[field] ??= issue.message;
    }
    return fail("Confira os campos destacados.", values, fieldErrors);
  }

  try {
    // Written to `published`, never to `draft`. A telephone number is
    // operational, not editorial: the office correcting it needs the
    // correction live now, not after someone remembers to publish.
    await db
      .insert(tenantContent)
      .values({
        tenantSlug: tenant.slug,
        key: OFFICE_CONTACT_KEY,
        published: parsed.data,
        publishedAt: new Date(),
        updatedBy: session.user.id,
      })
      .onConflictDoUpdate({
        target: [tenantContent.tenantSlug, tenantContent.key],
        set: {
          published: parsed.data,
          publishedAt: new Date(),
          updatedAt: new Date(),
          updatedBy: session.user.id,
        },
      });
  } catch {
    return fail(GENERIC_ERROR, values);
  }

  await recordAudit({
    tenantSlug: tenant.slug,
    actorId: session.user.id,
    action: "office-settings.save",
    targetType: "tenant-content",
    targetId: OFFICE_CONTACT_KEY,
  });

  // Opening hours and contacts are printed in the public layout, on the home
  // page and on the contact page. A narrower target would be a guess; this is
  // the one that is right until something measures otherwise.
  revalidatePath("/", "layout");
  return { status: "saved" };
}

export type OfficeDeadlineState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message: string; value: string };

/**
 * The office's default term for a service request. The same discipline as
 * `saveOfficeContact`: the schema is the boundary, the check is on the
 * server, and the write goes straight to `published` because a term is
 * operational, not editorial.
 */
export async function saveOfficeDeadline(
  _previous: OfficeDeadlineState,
  formData: FormData,
): Promise<OfficeDeadlineState> {
  const value = String(formData.get("requestDeadlineDays") ?? "").trim();

  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "content.edit")) {
    return {
      status: "error",
      message: "Você não tem permissão para alterar estes dados.",
      value,
    };
  }
  const tenant = await getTenant();

  const parsed = OfficeDeadlineSchema.safeParse({
    // An empty field reaches the schema as NaN and is refused there, rather
    // than silently becoming zero.
    requestDeadlineDays: Number(value),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ??
        "Informe um prazo entre 1 e 365 dias.",
      value,
    };
  }

  try {
    await db
      .insert(tenantContent)
      .values({
        tenantSlug: tenant.slug,
        key: OFFICE_DEADLINE_KEY,
        published: parsed.data,
        publishedAt: new Date(),
        updatedBy: session.user.id,
      })
      .onConflictDoUpdate({
        target: [tenantContent.tenantSlug, tenantContent.key],
        set: {
          published: parsed.data,
          publishedAt: new Date(),
          updatedAt: new Date(),
          updatedBy: session.user.id,
        },
      });
  } catch {
    return { status: "error", message: GENERIC_ERROR, value };
  }

  await recordAudit({
    tenantSlug: tenant.slug,
    actorId: session.user.id,
    action: "office-settings.save",
    targetType: "tenant-content",
    targetId: OFFICE_DEADLINE_KEY,
  });

  // The term shows on the request confirmation and on the protocol consult,
  // and it is read by the queue's badge in the panel.
  revalidatePath("/", "layout");
  revalidatePath("/admin/pedidos");
  return { status: "saved" };
}
