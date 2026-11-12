import { notFound } from "next/navigation";
import {
  can,
  effectivePermissions,
  GRANTABLE_LABELS,
  GRANTABLE_PERMISSIONS,
  PANEL_ROLES,
} from "@/core/auth/roles.ts";
import { getRolePermissions } from "@/lib/role-permissions.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { ROLE_LABELS } from "../../../_components/role-labels.ts";
import { ConfiguracoesTabs } from "../_components/tabs.tsx";
import { RolesForm } from "./roles-form.tsx";

export const metadata = { title: "Perfis e permissões" };

export default async function RolesPage() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "user.manage", session.user.permissions)
  ) {
    notFound();
  }
  const tenant = await getTenant();
  const configured = await getRolePermissions(tenant.slug);
  const roles = PANEL_ROLES.filter((role) => role !== "admin").map((role) => ({
    id: role,
    label: ROLE_LABELS[role],
    granted: effectivePermissions(role, configured).filter((p) =>
      (GRANTABLE_PERMISSIONS as readonly string[]).includes(p),
    ),
  }));

  return (
    <>
      <AdminPageHeader maxWidth={1000} title="Configurações" />
      <main className="flex max-w-[1000px] flex-col gap-4.5 px-[30px] py-7">
        <ConfiguracoesTabs
          role={session.user.role ?? ""}
          permissions={session.user.permissions}
        />
        <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
            Perfis e permissões
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-admin-muted">
            Marque o que cada cargo faz e vê no painel. O Tabelião/Registrador
            tem acesso total e é o único que cadastra as pessoas, define estas
            permissões e acompanha a auditoria. Cada cargo começa com um padrão,
            e a mudança vale para todas as pessoas daquele cargo no próximo
            clique delas.
          </p>
        </section>
        <RolesForm
          roles={roles}
          permissions={GRANTABLE_PERMISSIONS.map((id) => ({
            id,
            label: GRANTABLE_LABELS[id],
          }))}
        />
      </main>
    </>
  );
}
