import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { getOfficeAlerts } from "@/lib/office-alerts.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { ConfiguracoesTabs } from "../_components/tabs.tsx";
import { OfficeAlertsForm } from "./office-alerts-form.tsx";

export const metadata = { title: "Notificações" };

export default async function NotificationSettingsPage() {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "content.edit")) notFound();
  const tenant = await getTenant();
  const alerts = await getOfficeAlerts(tenant.slug);

  return (
    <>
      <AdminPageHeader title="Configurações" />
      <main className="flex max-w-[860px] flex-col gap-4.5 px-[30px] py-7">
        <ConfiguracoesTabs role={session.user.role ?? ""} />
        <OfficeAlertsForm initial={alerts} />
      </main>
    </>
  );
}
