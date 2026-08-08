import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { ConfiguracoesTabs } from "../_components/tabs.tsx";
import { VisualIdentityForm } from "./visual-identity-form.tsx";

export const metadata = { title: "Identidade Visual" };

export default async function VisualIdentityPage() {
  // Same shape as configuracoes/page.tsx, different permission: branding.edit
  // decides how the office presents itself, not the day to day content.edit
  // the Serventia tab uses (see design.md, decision 0).
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "branding.edit")) notFound();
  const tenant = await getTenant();

  return (
    <>
      <AdminPageHeader title="Configurações" />
      <main className="flex max-w-[1180px] flex-col gap-4.5 px-[30px] py-7">
        <ConfiguracoesTabs role={session.user.role ?? ""} />
        <VisualIdentityForm tenant={tenant} />
      </main>
    </>
  );
}
