"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import { OfficeDpoSchema } from "@/core/tenant/overrides.ts";
import { db } from "@/db/index.ts";
import { tenantContent } from "@/db/schema.ts";
import { recordAudit } from "@/lib/audit.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, OFFICE_DPO_KEY } from "@/lib/tenant.ts";

/** The two fields as they were typed, unvalidated. */
export type DpoValues = Record<"name" | "email", string>;

export type DpoState =
  | { status: "idle" }
  | { status: "saved" }
  | {
      status: "error";
      message: string;
      fieldErrors: Record<string, string>;
      // Echoed back for the same reason as saveOfficeContact: an uncontrolled
      // form resets on action resolution, and the field that was right
      // should not be lost while the person fixes the one that was wrong.
      values: DpoValues;
    };

const GENERIC_ERROR =
  "Não foi possível salvar agora. Tente novamente em instantes.";

function fail(
  message: string,
  values: DpoValues,
  fieldErrors: Record<string, string> = {},
): DpoState {
  return { status: "error", message, fieldErrors, values };
}

export async function saveDpo(
  _previous: DpoState,
  formData: FormData,
): Promise<DpoState> {
  // Only these two names are ever read. Name, CNS, attributions and the Pix
  // key are not in the shape, so a forged submission carrying them changes
  // nothing: the schema is the boundary, not a defensive branch here.
  const values: DpoValues = {
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
  };

  const session = await getSession();
  // Hiding the tab is not the check; this is.
  if (!session || !can(session.user.role ?? "", "content.edit")) {
    return fail("Você não tem permissão para alterar estes dados.", values);
  }
  const tenant = await getTenant();

  const parsed = OfficeDpoSchema.safeParse({
    dpo: { name: values.name, email: values.email },
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      // "dpo.email" -> "email": the form names its inputs flat.
      const field = String(issue.path.at(-1) ?? "");
      fieldErrors[field] ??= issue.message;
    }
    return fail("Confira os campos destacados.", values, fieldErrors);
  }

  try {
    // Written to `published`, never `draft`. The Encarregado is an
    // institutional channel required by law: the correction has to be live
    // the moment it is saved, not after a separate publish step.
    await db
      .insert(tenantContent)
      .values({
        tenantSlug: tenant.slug,
        key: OFFICE_DPO_KEY,
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
    action: "office-dpo.save",
    targetType: "tenant-content",
    targetId: OFFICE_DPO_KEY,
  });

  // The DPO's contact is printed on the LGPD page, under the root layout.
  revalidatePath("/", "layout");
  return { status: "saved" };
}
