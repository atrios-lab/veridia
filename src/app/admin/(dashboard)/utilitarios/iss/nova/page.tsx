import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { fundsOf } from "@/core/iss/declaration.ts";
import { getIssSettings } from "@/lib/iss-declarations.ts";
import { getSession } from "@/lib/session.ts";
import { getGuideSettings } from "@/lib/tax-guides.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { BackLink } from "../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { IssForm } from "../iss-form.tsx";

export const metadata = { title: "Nova declaração de ISS" };

/** The previous month, in the office's calendar: the one usually declared. */
function lastMonth(todayIso: string): string {
  const year = Number(todayIso.slice(0, 4));
  const month = Number(todayIso.slice(5, 7));
  return month === 1
    ? `${year - 1}-12`
    : `${year}-${String(month - 1).padStart(2, "0")}`;
}

export default async function NewIssPage() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "iss.manage", session.user.permissions)
  ) {
    notFound();
  }
  const tenant = await getTenant();
  const settings = await getIssSettings(tenant);
  return (
    <>
      <AdminPageHeader maxWidth={900} title="Nova declaração de ISS" />
      <main className="flex max-w-[900px] flex-col gap-4.5 px-[30px] py-7 max-md:px-4">
        <BackLink href="/admin/utilitarios/iss" label="Declaração de ISS" />
        <IssForm
          state={{
            uf: tenant.location.state,
            funds: fundsOf(tenant),
            signers: (await getGuideSettings(tenant)).signers.map(
              ({ name, title }) => ({ name, title }),
            ),
            canPublish: can(
              session.user.role ?? "",
              "transparency.manage",
              session.user.permissions,
            ),
          }}
          initial={{
            today: today(),
            competence: lastMonth(today()),
            emoluments: "",
            rate: (settings.rateBasisPoints / 100).toFixed(2).replace(".", ","),
            damNumber: "",
            dueDate: "",
            paidOn: "",
            notes: "",
          }}
        />
      </main>
    </>
  );
}
