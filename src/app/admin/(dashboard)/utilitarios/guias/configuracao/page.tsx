import { notFound } from "next/navigation";
import { BackLink } from "@/app/admin/_components/back-link";
import { can } from "@/core/auth/roles.ts";
import { getSession } from "@/lib/session.ts";
import { getGuideSettings } from "@/lib/tax-guides.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { GuideSettingsForm } from "./settings-form.tsx";

export const metadata = { title: "Configuração das guias" };

export default async function GuideSettingsPage() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "content.edit", session.user.permissions)
  )
    notFound();
  const settings = await getGuideSettings(await getTenant());
  return (
    <>
      <AdminPageHeader title="Leis, alíquotas e quem assina" />
      <main className="flex max-w-[960px] flex-col gap-4.5 px-[30px] py-7">
        <BackLink
          href="/admin/utilitarios/guias"
          label="Guias de transmissão de bens"
        />
        <GuideSettingsForm initial={settings} />
      </main>
    </>
  );
}
