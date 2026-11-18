import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { getSession } from "@/lib/session.ts";
import { getGuideSettings } from "@/lib/tax-guides.ts";
import { teamSignersWith } from "@/lib/team.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { SignersEditor } from "../../../_components/signers-editor.tsx";
import { TeamSignersNotice } from "../../../_components/team-signers-notice.tsx";
import { ConfiguracoesTabs } from "../_components/tabs.tsx";

export const metadata = { title: "Quem assina" };

/** Configurações › Documentos › Quem assina: the office's one list. */
export default async function SignersPage() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "content.edit", session.user.permissions)
  ) {
    notFound();
  }
  const tenant = await getTenant();
  const settings = await getGuideSettings(tenant, { legacySigners: true });
  const fromTeam = await teamSignersWith(db, tenant.slug).catch(() => []);
  const canEditTeam = can(
    session.user.role ?? "",
    "team.edit",
    session.user.permissions,
  );
  return (
    <>
      <AdminPageHeader maxWidth={960} title="Configurações" />
      <main className="flex max-w-[960px] flex-col gap-6 px-4 pt-6 pb-8 md:px-8">
        <ConfiguracoesTabs
          role={session.user.role ?? ""}
          permissions={session.user.permissions}
        />
        {fromTeam.length > 0 ? (
          <TeamSignersNotice signers={fromTeam} canEditTeam={canEditTeam} />
        ) : (
          <>
            <SignersEditor initial={settings.signers} />
            {canEditTeam && (
              <p className="text-sm text-muted-foreground">
                Prefere cuidar de todas as pessoas do cartório num lugar só? Na{" "}
                <Link
                  href="/admin/configuracoes/equipe"
                  className="font-medium text-primary underline underline-offset-4"
                >
                  Equipe do cartório
                </Link>{" "}
                você pode trazer esta lista, na mesma ordem, e marcar quem pode
                assinar.
              </p>
            )}
          </>
        )}
      </main>
    </>
  );
}
