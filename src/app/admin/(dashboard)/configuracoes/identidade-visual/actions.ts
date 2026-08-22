"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import type { BrandImageKind } from "@/core/tenant/brand-image.ts";
import { optionalSections } from "@/core/tenant/gating.ts";
import { OfficeBrandSchema } from "@/core/tenant/overrides.ts";
import type { Section, Theme } from "@/core/tenant/schema.ts";
import { db } from "@/db/index.ts";
import { tenantContent } from "@/db/schema.ts";
import { recordAudit } from "@/lib/audit.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, OFFICE_BRAND_KEY } from "@/lib/tenant.ts";
import { BrandImageError, storeBrandImage } from "@/lib/uploads.ts";

/** The fields as they were typed or chosen, unvalidated. */
export type VisualIdentityValues = {
  theme: string;
  eyebrow: string;
  title: string;
  disabledSections: string[];
};

export type VisualIdentityState =
  | { status: "idle" }
  | { status: "saved" }
  | {
      status: "error";
      message: string;
      fieldErrors: Record<string, string>;
      // Same reasoning as saveOfficeContact: React resets an uncontrolled
      // form once the action resolves, so a failed submit would otherwise
      // wipe every field that was right. Files are not echoed: the browser
      // cannot repopulate a file input, and asking the person to pick the
      // same file again is the honest cost of a rejected upload.
      values: VisualIdentityValues;
    };

const GENERIC_ERROR =
  "Não foi possível salvar agora. Tente novamente em instantes.";

function fail(
  message: string,
  values: VisualIdentityValues,
  fieldErrors: Record<string, string> = {},
): VisualIdentityState {
  return { status: "error", message, fieldErrors, values };
}

/**
 * Reads one of the optional image inputs. An absent or empty file
 * input means "keep what is published": the browser encodes an untouched
 * `<input type="file">` as a zero byte part, same signal `storeAttachments`
 * relies on.
 */
async function resolveImage(
  formData: FormData,
  field: string,
  kind: BrandImageKind,
  current: string | undefined,
  tenantSlug: string,
): Promise<string | undefined> {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) return current;
  return storeBrandImage(file, kind, tenantSlug);
}

export async function saveVisualIdentity(
  _previous: VisualIdentityState,
  formData: FormData,
): Promise<VisualIdentityState> {
  const values: VisualIdentityValues = {
    theme: String(formData.get("theme") ?? "").trim(),
    eyebrow: String(formData.get("eyebrow") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    disabledSections: formData.getAll("disabledSections").map(String),
  };

  const session = await getSession();
  // Hiding the tab is not the check; this is. The permission is
  // branding.edit, deciding how the office presents itself, not the day to
  // day content.edit that the Serventia tab uses.
  if (!session || !can(session.user.role ?? "", "branding.edit")) {
    return fail("Você não tem permissão para alterar estes dados.", values);
  }
  const tenant = await getTenant();

  // Defence in depth on top of OfficeBrandSchema's own refine: a submitted
  // section this office does not even hold is dropped before it ever reaches
  // the schema, rather than trusted to be harmless there.
  const grantable = new Set(optionalSections(tenant));
  const disabledSections = values.disabledSections.filter((s) =>
    grantable.has(s as Section),
  ) as Section[];

  let logoLight: string | undefined;
  let logoDark: string | undefined;
  let sealLight: string | undefined;
  let sealDark: string | undefined;
  let heroImage: string | undefined;
  try {
    logoLight = await resolveImage(
      formData,
      "logoLight",
      "logo-light",
      tenant.logos.light,
      tenant.slug,
    );
    logoDark = await resolveImage(
      formData,
      "logoDark",
      "logo-dark",
      tenant.logos.dark,
      tenant.slug,
    );
    sealLight = await resolveImage(
      formData,
      "sealLight",
      "seal-light",
      tenant.logos.seal.light,
      tenant.slug,
    );
    sealDark = await resolveImage(
      formData,
      "sealDark",
      "seal-dark",
      tenant.logos.seal.dark,
      tenant.slug,
    );
    heroImage = await resolveImage(
      formData,
      "heroImage",
      "hero",
      tenant.heroImage,
      tenant.slug,
    );
  } catch (error) {
    if (error instanceof BrandImageError) {
      return fail(error.message, values);
    }
    return fail(GENERIC_ERROR, values);
  }

  const parsed = OfficeBrandSchema.safeParse({
    theme: values.theme as Theme,
    logos: {
      light: logoLight,
      dark: logoDark,
      seal: { light: sealLight, dark: sealDark },
    },
    heroImage,
    home: { eyebrow: values.eyebrow, title: values.title },
    disabledSections,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      // "home.title" -> "title": the form names its inputs flat.
      const field = String(issue.path.at(-1) ?? "");
      fieldErrors[field] ??= issue.message;
    }
    return fail("Confira os campos destacados.", values, fieldErrors);
  }

  try {
    // Written to `published`, never to `draft`: "Salvar e publicar" is the
    // publication, and the tab has no separate draft state of its own.
    await db
      .insert(tenantContent)
      .values({
        tenantSlug: tenant.slug,
        key: OFFICE_BRAND_KEY,
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
    action: "office-brand.save",
    targetType: "tenant-content",
    targetId: OFFICE_BRAND_KEY,
  });

  // Theme, logos, hero and sections all reach the public layout and the
  // home page, both under the root layout: same target saveOfficeContact
  // uses, for the same reason.
  revalidatePath("/", "layout");
  return { status: "saved" };
}
