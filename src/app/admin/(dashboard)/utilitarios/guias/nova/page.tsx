import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { emptyGuide } from "@/core/guides/schema.ts";
import { getSession } from "@/lib/session.ts";
import { getGuideSettings } from "@/lib/tax-guides.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { GuideForm } from "../guide-form.tsx";

export const metadata = { title: "Nova guia de transmissão de bens" };

export default async function NewGuidePage() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "guides.manage", session.user.permissions)
  )
    notFound();
  const settings = await getGuideSettings(await getTenant());
  return (
    <>
      <AdminPageHeader title="Nova guia de transmissão de bens" />
      <main className="max-w-[1100px] px-[30px] py-7">
        <GuideForm initial={emptyGuide(settings)} settings={settings} />
      </main>
    </>
  );
}
