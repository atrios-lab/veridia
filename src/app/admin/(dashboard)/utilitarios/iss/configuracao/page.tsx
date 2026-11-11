import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { legalBasis } from "@/core/iss/declaration.ts";
import { getIssSettings } from "@/lib/iss-declarations.ts";
import { getSession } from "@/lib/session.ts";
import { getGuideSettings } from "@/lib/tax-guides.ts";
import { getTenant } from "@/lib/tenant.ts";
import { BackLink } from "../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { SignersEditor } from "../../../../_components/signers-editor.tsx";
import { IssSettingsForm } from "./settings-form.tsx";

export const metadata = { title: "Configuração da Declaração de ISS" };

export default async function IssSettingsPage() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "content.edit", session.user.permissions)
  ) {
    notFound();
  }
  const tenant = await getTenant();
  const settings = await getIssSettings(tenant);
  return (
    <>
      <AdminPageHeader title="Configuração da Declaração de ISS" />
      <main className="flex max-w-[900px] flex-col gap-4.5 px-[30px] py-7 max-md:px-4">
        <BackLink href="/admin/utilitarios/iss" label="Declaração de ISS" />
        <IssSettingsForm settings={settings} />
        <SignersEditor initial={(await getGuideSettings(tenant)).signers} />
        <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
            Fundamentação que sai no PDF
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[12.5px] leading-relaxed text-admin-text">
            {legalBasis(tenant, settings).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
