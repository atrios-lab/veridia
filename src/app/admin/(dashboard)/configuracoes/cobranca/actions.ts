"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import { OfficePixSchema } from "@/core/tenant/overrides.ts";
import type { PixKeyType } from "@/core/tenant/pix.ts";
import { normalizePixKey } from "@/core/tenant/pix.ts";
import { db } from "@/db/index.ts";
import { tenantContent } from "@/db/schema.ts";
import { recordAudit } from "@/lib/audit.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, OFFICE_PIX_KEY } from "@/lib/tenant.ts";

/** The two fields as they were typed, unvalidated. */
export type PixKeyValues = { type: string; key: string };

export type PixKeyState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "removed" }
  | {
      status: "error";
      message: string;
      fieldErrors: Record<string, string>;
      // Same reasoning as saveOfficeContact: an uncontrolled form resets on
      // action resolution, and a rejected type should not cost the value the
      // person already typed correctly.
      values: PixKeyValues;
    };

const GENERIC_ERROR =
  "Não foi possível salvar agora. Tente novamente em instantes.";

function fail(
  message: string,
  values: PixKeyValues,
  fieldErrors: Record<string, string> = {},
): PixKeyState {
  return { status: "error", message, fieldErrors, values };
}

export async function savePixKey(
  _previous: PixKeyState,
  formData: FormData,
): Promise<PixKeyState> {
  const values: PixKeyValues = {
    type: String(formData.get("type") ?? ""),
    key: String(formData.get("key") ?? "").trim(),
  };

  const session = await getSession();
  // Hiding the button is not the check; this is. billing.edit, not
  // content.edit: the key that receives the citizen's money is not day to
  // day content.
  if (!session || !can(session.user.role ?? "", "billing.edit")) {
    return fail("Você não tem permissão para alterar a chave.", values);
  }
  const tenant = await getTenant();

  const parsed = OfficePixSchema.safeParse({
    pix: {
      type: values.type as PixKeyType,
      key: values.key,
    },
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      // "pix.key" -> "key": the form names its inputs flat.
      const field = String(issue.path.at(-1) ?? "");
      fieldErrors[field] ??= issue.message;
    }
    return fail("Confira os campos destacados.", values, fieldErrors);
  }

  // Normalized before it is stored: what is kept is what a payload would one
  // day need, not the formatting the registrar happened to type.
  const normalized = {
    pix: {
      type: parsed.data.pix.type,
      key: normalizePixKey(parsed.data.pix.type, parsed.data.pix.key),
    },
  };

  try {
    // Written to `published`, never `draft`: the key that receives money is
    // operational, and the correction has to be live the moment it saves.
    await db
      .insert(tenantContent)
      .values({
        tenantSlug: tenant.slug,
        key: OFFICE_PIX_KEY,
        published: normalized,
        publishedAt: new Date(),
        updatedBy: session.user.id,
      })
      .onConflictDoUpdate({
        target: [tenantContent.tenantSlug, tenantContent.key],
        set: {
          published: normalized,
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
    action: "office-pix.save",
    targetType: "tenant-content",
    targetId: OFFICE_PIX_KEY,
  });

  // The Pix key feeds the QR code on the public protocol lookup page.
  revalidatePath("/", "layout");
  return { status: "saved" };
}

export async function removePixKey(
  _previous: PixKeyState,
  _formData: FormData,
): Promise<PixKeyState> {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "billing.edit")) {
    return fail("Você não tem permissão para remover a chave.", {
      type: "",
      key: "",
    });
  }
  const tenant = await getTenant();

  try {
    // A dedicated action, not a blank value: an empty field is a typo, not a
    // decision to stop accepting Pix.
    await db
      .delete(tenantContent)
      .where(
        and(
          eq(tenantContent.tenantSlug, tenant.slug),
          eq(tenantContent.key, OFFICE_PIX_KEY),
        ),
      );
  } catch {
    return fail(GENERIC_ERROR, { type: "", key: "" });
  }

  await recordAudit({
    tenantSlug: tenant.slug,
    actorId: session.user.id,
    action: "office-pix.remove",
    targetType: "tenant-content",
    targetId: OFFICE_PIX_KEY,
  });

  revalidatePath("/", "layout");
  return { status: "removed" };
}
