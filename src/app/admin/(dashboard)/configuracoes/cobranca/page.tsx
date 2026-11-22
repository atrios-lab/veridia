import { notFound } from "next/navigation";
import { FeeTableReminder } from "@/app/admin/_components/fee-table-reminder.tsx";
import { can } from "@/core/auth/roles.ts";
import {
  formatMoney,
  PRENOTATION_ATTRIBUTIONS,
  PRENOTATION_LABELS,
} from "@/core/fees/prenotation.ts";
import { formatOfficeDateTime } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { currentPrenotation, feeTableReferenceWith } from "@/lib/fee-tables.ts";
import { getPrenotationChargeSetting } from "@/lib/prenotation-charge.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { ConfiguracoesTabs } from "../_components/tabs.tsx";
import { PixKeyForm } from "./pix-key-form.tsx";
import { PrenotationSwitch } from "./prenotation-switch.tsx";

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

  const [setting, table, ...prices] = await Promise.all([
    getPrenotationChargeSetting(tenant.slug),
    feeTableReferenceWith(db, tenant.slug).catch(() => null),
    ...PRENOTATION_ATTRIBUTIONS.map((attribution) =>
      currentPrenotation(tenant, attribution).catch(() => undefined),
    ),
  ]);
  const priceRows = PRENOTATION_ATTRIBUTIONS.map((attribution, index) => {
    const found = prices[index];
    return {
      label: PRENOTATION_LABELS[attribution],
      price: found
        ? `${formatMoney(found.item.totalCents)} (código ${found.item.code})`
        : null,
    };
  });

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
        <div className="flex flex-col gap-4 rounded-xl border-2 border-primary/30 bg-card p-6">
          <PrenotationSwitch
            enabled={setting.enabled}
            canEdit={canEdit}
            prices={priceRows}
            changedLabel={
              setting.at ? formatOfficeDateTime(new Date(setting.at)) : null
            }
          />
          <FeeTableReminder
            table={table}
            canUpdate={can(
              session.user.role ?? "",
              "transparency.manage",
              session.user.permissions,
            )}
          />
        </div>
      </main>
    </>
  );
}
