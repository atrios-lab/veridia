import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/app/admin/_components/back-link";
import { can, type Role } from "@/core/auth/roles.ts";
import { formatOfficeDateTime } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { listAllConversationsWith, listTeamWith } from "@/lib/messages.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { ROLE_LABELS } from "../../../_components/role-labels.ts";
import { TeamPanel } from "./team-panel.tsx";

export const metadata = { title: "Todas as conversas" };

/** The Tabelião/Registrador's view of every internal conversation. */
export default async function OversightPage() {
  const session = await getSession();
  const role = session?.user.role ?? "";
  if (
    !session ||
    !(
      role === "superadmin" ||
      can(role, "audit.manage", session.user.permissions)
    )
  ) {
    notFound();
  }
  const tenant = await getTenant();
  const holder = can(role, "audit.manage", session.user.permissions);
  const [conversations, team] = await Promise.all([
    listAllConversationsWith(db, tenant.slug),
    holder ? listTeamWith(db, tenant.slug) : Promise.resolve([]),
  ]);
  return (
    <>
      <AdminPageHeader maxWidth={900} title="Mensagens internas" />
      <main className="flex max-w-[900px] flex-col gap-4 px-[30px] py-7 max-md:px-4">
        {role !== "superadmin" && (
          <BackLink href="/admin/mensagens" label="Minhas mensagens" />
        )}
        {holder && (
          <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
            <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
              Equipe: horário de almoço e chat
            </h2>
            <p className="mt-1 text-[12.5px] text-admin-muted">
              Cada pessoa pede o próprio horário de almoço (até 1 hora por dia);
              ele só vale depois que você aprovar. Fora desse horário a pessoa
              volta a aparecer disponível sozinha. Você também pode desligar o
              chat de alguém. Tudo vai para a auditoria.
            </p>
            <TeamPanel
              team={team.map((m) => ({
                userId: m.userId,
                name: m.name,
                role: ROLE_LABELS[m.role as Role] ?? m.role,
                lunch: m.lunch,
                lunchPending: m.lunchPending,
                requestedAt: m.lunchRequestedAt
                  ? formatOfficeDateTime(m.lunchRequestedAt)
                  : null,
                chatDisabled: m.chatDisabled,
                presence: m.presence,
                status: m.status,
                statusSince: m.statusSince
                  ? formatOfficeDateTime(m.statusSince)
                  : null,
                lingering: m.lingering,
              }))}
            />
          </section>
        )}
        <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
            Todas as conversas da serventia
          </h2>
          <p className="mt-1 text-[12.5px] text-admin-muted">
            Só leitura. Aqui aparecem também as mensagens apagadas e o texto
            original das editadas; as telas do chat não avisam que existe esta
            supervisão.
          </p>
          {conversations.length === 0 ? (
            <p className="mt-3 text-[13px] text-admin-muted">
              Nenhuma conversa ainda.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-admin-border">
              {conversations.map((c) => (
                <li key={c.id} className="py-2.5 text-[13px]">
                  <Link
                    href={`/admin/mensagens/supervisao/${c.id}`}
                    className="font-semibold text-admin-primary hover:underline"
                  >
                    {c.members.join(" e ")}
                  </Link>
                  <p className="text-[12px] text-admin-muted">
                    {c.messages} mensagem(ns)
                    {c.lastMessageAt &&
                      ` · última em ${formatOfficeDateTime(c.lastMessageAt)}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
