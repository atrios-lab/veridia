import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { ConfiguracoesTabs } from "../_components/tabs.tsx";
import { DpoForm } from "./dpo-form.tsx";

export const metadata = { title: "Encarregado" };

export default async function DpoSettingsPage() {
  // Same shape as configuracoes/page.tsx: the layout already proved session
  // and admin.access, this screen checks content.edit for itself.
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "content.edit")) notFound();
  const tenant = await getTenant();

  return (
    <>
      <AdminPageHeader title="Configurações" />
      <main className="flex max-w-[720px] flex-col gap-4.5 px-[30px] py-7">
        <ConfiguracoesTabs role={session.user.role ?? ""} />
        <div className="rounded-[14px] border border-admin-border bg-admin-card p-6">
          <DpoForm tenant={tenant} />
        </div>
      </main>
    </>
  );
}
