import { notFound, redirect } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { getProfileWith, listContactsWith } from "@/lib/messages.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import { Messenger } from "./messenger.tsx";

export const metadata = { title: "Mensagens internas" };

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ com?: string }>;
}) {
  const session = await getSession();
  const role = session?.user.role ?? "";
  if (!session || !can(role, "desk.access", session.user.permissions)) {
    notFound();
  }
  // The Átrios account only reads: straight to every conversation.
  if (role === "superadmin") redirect("/admin/mensagens/supervisao");
  const tenant = await getTenant();
  const [profile, contacts] = await Promise.all([
    getProfileWith(db, tenant.slug, session.user.id),
    listContactsWith(db, tenant.slug, session.user.id),
  ]);
  const { com } = await searchParams;
  const chosen = contacts.find((c) => c.userId === com);
  const oversight =
    role === "superadmin" ||
    can(role, "audit.manage", session.user.permissions);

  if (profile?.chatDisabled) {
    return (
      <>
        <AdminPageHeader title="Mensagens internas" />
        <main className="px-[30px] py-7 max-md:px-4">
          <p className="max-w-[640px] rounded-[14px] border border-admin-border bg-admin-card px-5 py-4 text-[13.5px] text-admin-text">
            Suas mensagens internas foram desativadas pelo Tabelião/Registrador.
            Fale com ele para reativar.
          </p>
        </main>
      </>
    );
  }
  return (
    <>
      <AdminPageHeader title="Mensagens internas" />
      <main className="px-[30px] py-5 max-md:px-3">
        <Messenger
          me={{
            userId: session.user.id,
            name: profile?.name ?? session.user.name,
            photo: profile?.photo ?? false,
            status: profile?.status ?? "disponivel",
            personalMessage: profile?.personalMessage ?? "",
            color: profile?.color ?? "verde",
            sound: profile?.sound ?? true,
            lunch: profile?.lunch ?? null,
            lunchPending: profile?.lunchPending ?? null,
            atLunch: profile?.atLunch ?? false,
          }}
          initialContacts={contacts.map((c) => ({
            ...c,
            lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
          }))}
          initialConversation={
            chosen?.conversationId
              ? { id: chosen.conversationId, withUserId: chosen.userId }
              : null
          }
          oversight={oversight}
        />
      </main>
    </>
  );
}
