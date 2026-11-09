import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { getSession } from "@/lib/session.ts";
import { getGuideSettings } from "@/lib/tax-guides.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { GuideSettingsForm } from "./settings-form.tsx";

export const metadata = { title: "Configuração das guias" };

export default async function GuideSettingsPage() {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "content.edit")) notFound();
  const settings = await getGuideSettings(await getTenant());
  return (
    <>
      <AdminPageHeader title="Leis, alíquotas e quem assina" />
      <main className="flex max-w-[960px] flex-col gap-4.5 px-[30px] py-7">
        <Link
          href="/admin/utilitarios/guias"
          className="text-[12.5px] font-semibold text-admin-muted hover:underline"
        >
          ‹ Guias de recolhimento
        </Link>
        <GuideSettingsForm initial={settings} />
      </main>
    </>
  );
}
