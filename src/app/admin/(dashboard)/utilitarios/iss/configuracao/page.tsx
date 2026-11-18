import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { legalBasis } from "@/core/iss/declaration.ts";
import { db } from "@/db/index.ts";
import { getIssSettings } from "@/lib/iss-declarations.ts";
import { getSession } from "@/lib/session.ts";
import { getGuideSettings } from "@/lib/tax-guides.ts";
import { teamSignersWith } from "@/lib/team.ts";
import { getTenant } from "@/lib/tenant.ts";
import { BackLink } from "../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { SignersEditor } from "../../../../_components/signers-editor.tsx";
import { TeamSignersNotice } from "../../../../_components/team-signers-notice.tsx";
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
  const fromTeam = await teamSignersWith(db, tenant.slug).catch(() => []);
  const legacy = (await getGuideSettings(tenant, { legacySigners: true }))
    .signers;
  return (
    <>
      <AdminPageHeader
        maxWidth={900}
        title="Configuração da Declaração de ISS"
      />
      <main className="flex max-w-[900px] flex-col gap-4.5 px-4 py-7 md:px-8">
        <BackLink href="/admin/utilitarios/iss" label="Declaração de ISS" />
        <IssSettingsForm settings={settings} />
        {fromTeam.length > 0 ? (
          <TeamSignersNotice
            signers={fromTeam}
            canEditTeam={can(
              session.user.role ?? "",
              "team.edit",
              session.user.permissions,
            )}
          />
        ) : (
          <SignersEditor initial={legacy} />
        )}
        <section className="rounded-xl border bg-card px-5 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Fundamentação que sai no PDF
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-foreground">
            {legalBasis(tenant, settings).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
