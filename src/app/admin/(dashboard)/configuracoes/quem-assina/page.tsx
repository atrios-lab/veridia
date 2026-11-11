import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { getSession } from "@/lib/session.ts";
import { getGuideSettings } from "@/lib/tax-guides.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { SignersEditor } from "../../../_components/signers-editor.tsx";
import { ConfiguracoesTabs } from "../_components/tabs.tsx";

export const metadata = { title: "Quem assina" };

/** Configurações › Documentos › Quem assina: the office's one list. */
export default async function SignersPage() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "content.edit", session.user.permissions)
  ) {
    notFound();
  }
  const settings = await getGuideSettings(await getTenant());
  return (
    <>
      <AdminPageHeader title="Configurações" />
      <main className="flex max-w-[960px] flex-col gap-4.5 px-[30px] py-7">
        <ConfiguracoesTabs
          role={session.user.role ?? ""}
          permissions={session.user.permissions}
        />
        <SignersEditor initial={settings.signers} />
      </main>
    </>
  );
}
