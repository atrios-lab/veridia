import { notFound } from "next/navigation";
import { can, type Role } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { conclusionPolicyWith, officePeopleWith } from "@/lib/routing.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { ROLE_LABELS } from "../../../_components/role-labels.ts";
import { ConfiguracoesTabs } from "../_components/tabs.tsx";
import { ConclusionForm } from "./conclusion-form.tsx";

export const metadata = { title: "Assinatura e conclusão" };

/** Configurações › Direcionamento › Assinatura e conclusão. */
export default async function ConclusionPage() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "routing.settings", session.user.permissions)
  ) {
    notFound();
  }
  const tenant = await getTenant();
  const [policy, people] = await Promise.all([
    conclusionPolicyWith(db, tenant.slug),
    officePeopleWith(db, tenant.slug),
  ]);
  return (
    <>
      <AdminPageHeader maxWidth={960} title="Configurações" />
      <main className="flex max-w-[960px] flex-col gap-6 px-4 pt-6 pb-8 md:px-8">
        <ConfiguracoesTabs
          role={session.user.role ?? ""}
          permissions={session.user.permissions}
        />
        <ConclusionForm
          mode={policy.mode}
          selected={policy.mode === "selected" ? policy.userIds : []}
          people={people.map((p) => ({
            id: p.id,
            name: p.name,
            roleLabel: ROLE_LABELS[p.role as Role] ?? p.role,
            holder: p.role === "admin",
          }))}
        />
      </main>
    </>
  );
}
