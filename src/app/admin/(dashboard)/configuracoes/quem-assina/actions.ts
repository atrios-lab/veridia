"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import { GuideSettingsSchema } from "@/core/guides/schema.ts";
import { db } from "@/db/index.ts";
import { getSession } from "@/lib/session.ts";
import { getGuideSettings, saveGuideSettingsWith } from "@/lib/tax-guides.ts";
import { teamSignersWith } from "@/lib/team.ts";
import { getTenant } from "@/lib/tenant.ts";

export type SignersState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message: string };

const SignersSchema = GuideSettingsSchema.shape.signers;

/**
 * Who signs the office's papers (decision of 11/11/2026): one list for the
 * guias, the Declaração de ISS and the declaração de comparecimento, edited
 * from any of them. Saved inside the guias' settings, where it always was.
 */
export async function saveOfficeSigners(
  _previous: SignersState,
  formData: FormData,
): Promise<SignersState> {
  const session = await getSession();
  const role = session?.user.role ?? "";
  const granted = session?.user.permissions;
  if (
    !session ||
    !(
      can(role, "content.edit", granted) ||
      can(role, "guides.manage", granted) ||
      can(role, "iss.manage", granted)
    )
  ) {
    return {
      status: "error",
      message: "Você não tem permissão para alterar quem assina.",
    };
  }
  let submitted: unknown;
  try {
    submitted = JSON.parse(String(formData.get("signers") ?? "null"));
  } catch {
    submitted = null;
  }
  const parsed = SignersSchema.safeParse(submitted);
  if (!parsed.success || parsed.data.length === 0) {
    return {
      status: "error",
      message: "Informe o nome de cada pessoa que assina (pelo menos uma).",
    };
  }
  const tenant = await getTenant();
  try {
    // The team feeds the list once someone there is marked to sign: the
    // saved one is not the list in use, so it is not changed from here.
    if ((await teamSignersWith(db, tenant.slug)).length > 0) {
      return {
        status: "error",
        message:
          "Esta lista agora vem da Equipe do cartório. Marque ou desmarque quem pode assinar lá.",
      };
    }
    const current = await getGuideSettings(tenant, { legacySigners: true });
    await saveGuideSettingsWith(
      db,
      tenant.slug,
      { ...current, signers: parsed.data },
      session.user.id,
    );
  } catch {
    return { status: "error", message: "Não foi possível salvar agora." };
  }
  revalidatePath("/admin", "layout");
  return { status: "saved" };
}
