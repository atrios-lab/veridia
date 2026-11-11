import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { formatOfficeDateTime } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { listAllConversationsWith } from "@/lib/messages.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";

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
  const conversations = await listAllConversationsWith(db, tenant.slug);
  return (
    <>
      <AdminPageHeader title="Mensagens" />
      <main className="flex max-w-[900px] flex-col gap-4 px-[30px] py-7 max-md:px-4">
        <Link
          href="/admin/mensagens"
          className="text-[12.5px] text-admin-muted hover:text-admin-primary"
        >
          ‹ Minhas mensagens
        </Link>
        <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
            Todas as conversas da serventia
          </h2>
          <p className="mt-1 text-[12.5px] text-admin-muted">
            Só leitura. Todos sabem, na própria tela de mensagens, que o
            Tabelião/Registrador pode ler as conversas.
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
