import { notFound } from "next/navigation";
import { can, type Role } from "@/core/auth/roles.ts";
import { sectorsOfUser } from "@/core/routing/routing.ts";
import { db } from "@/db/index.ts";
import {
  citizenLineEnabledWith,
  officePeopleWith,
  sectorMembers,
  sectorsWith,
} from "@/lib/routing.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { ROLE_LABELS } from "../../../_components/role-labels.ts";
import { ConfiguracoesTabs } from "../_components/tabs.tsx";
import {
  CitizenLineSwitch,
  MembersEditor,
  SectorsEditor,
} from "./sectors-editor.tsx";

export const metadata = { title: "Setores" };

/**
 * Configurações › Direcionamento › Setores (change
 * direcionamento-interno-de-pedidos): the sectors pedidos are sent to,
 * who works in each, and the line the citizen reads.
 */
export default async function SectorsPage() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "routing.settings", session.user.permissions)
  ) {
    notFound();
  }
  const tenant = await getTenant();
  const [{ sectors, stored }, people, citizenLine] = await Promise.all([
    sectorsWith(db, tenant.slug, tenant.attributions),
    officePeopleWith(db, tenant.slug),
    citizenLineEnabledWith(db, tenant.slug),
  ]);
  const members = sectorMembers(people, stored);
  return (
    <>
      <AdminPageHeader maxWidth={960} title="Configurações" />
      <main className="flex max-w-[960px] flex-col gap-6 px-4 pt-6 pb-8 md:px-8">
        <ConfiguracoesTabs
          role={session.user.role ?? ""}
          permissions={session.user.permissions}
        />
        <SectorsEditor
          sectors={sectors.map((s) => ({
            id: s.id,
            label: s.label,
            origin: s.origin,
            hidden: Boolean(s.hiddenAt),
            people: members.get(s.id)?.length ?? 0,
          }))}
        />
        <MembersEditor
          sectors={sectors.map((s) => ({
            id: s.id,
            label: s.label,
            origin: s.origin,
            hidden: Boolean(s.hiddenAt),
            people: members.get(s.id)?.length ?? 0,
          }))}
          people={people.map((p) => ({
            id: p.id,
            name: p.name,
            roleLabel: ROLE_LABELS[p.role as Role] ?? p.role,
            sectorIds: sectorsOfUser(stored, p),
          }))}
        />
        <CitizenLineSwitch enabled={citizenLine} />
      </main>
    </>
  );
}
