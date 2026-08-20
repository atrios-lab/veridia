import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { getConversation } from "@/lib/chat.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { ManualEntryForm } from "./manual-entry-form.tsx";

export const metadata = { title: "Lançar pedido manual" };

export default async function ManualEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ deConversa?: string }>;
}) {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "requests.manage")) notFound();
  const tenant = await getTenant();

  // Reached from "Lançar um pedido novo a partir desta conversa" at closing
  // time (see atendimento/[id]/_components/close-dialog.tsx): the form
  // pre-fills who the citizen already told the widget they were, and
  // submitting it links the new request back to the conversation and closes
  // it: see manual-entry-form.tsx and its action.
  const { deConversa } = await searchParams;
  const conversation = deConversa
    ? await getConversation(tenant.slug, deConversa)
    : undefined;

  return (
    <>
      <AdminPageHeader title="Lançar pedido manual" />
      <main className="max-w-[760px] px-[30px] py-7">
        <ManualEntryForm
          tenant={tenant}
          fromConversation={
            conversation
              ? {
                  id: conversation.id,
                  name: conversation.citizenName,
                  contact: conversation.citizenContact,
                }
              : undefined
          }
        />
      </main>
    </>
  );
}
