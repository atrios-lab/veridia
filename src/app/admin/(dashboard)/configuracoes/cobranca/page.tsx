import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { ConfiguracoesTabs } from "../_components/tabs.tsx";
import { PixKeyForm } from "./pix-key-form.tsx";

export const metadata = { title: "Cobrança" };

export default async function BillingSettingsPage() {
  // Opening the tab needs content.edit: an operator has to be able to check
  // which key is on the air. Saving or removing needs billing.edit, checked
  // again by the action on the server; here it only decides whether the
  // form renders as editable or as read-only.
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "content.edit", session.user.permissions)
  )
    notFound();
  const tenant = await getTenant();
  const canEdit = can(
    session.user.role ?? "",
    "billing.edit",
    session.user.permissions,
  );

  return (
    <>
      <AdminPageHeader maxWidth={720} title="Configurações" />
      <main className="flex max-w-[720px] flex-col gap-6 px-4 pt-6 pb-8 md:px-8">
        <ConfiguracoesTabs
          role={session.user.role ?? ""}
          permissions={session.user.permissions}
        />
        <div className="rounded-xl border bg-card p-6">
          <PixKeyForm tenant={tenant} canEdit={canEdit} />
        </div>
      </main>
    </>
  );
}
