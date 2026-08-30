import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  activeConversations,
  attendantSummary,
  readChatAvailability,
  waitingConversations,
} from "@/lib/chat.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import { QueuePoller } from "../../_components/queue-poller.tsx";
import { AssignButton } from "./_components/assign-button.tsx";
import { ChatToggle } from "./_components/chat-toggle.tsx";
import { StatusControl } from "./_components/status-control.tsx";

export const metadata = { title: "Atendimento online" };

function waitMinutes(waitingSince: Date, now: Date): number {
  return Math.floor((now.getTime() - waitingSince.getTime()) / 60_000);
}

function urgencyClass(minutes: number): string {
  if (minutes >= 10) return "text-admin-error-text";
  if (minutes >= 5) return "text-admin-warning-text";
  return "text-admin-success-text";
}

export default async function SupportChatQueuePage() {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "chat.manage")) notFound();

  const tenant = await getTenant();
  const [waiting, active, availability] = await Promise.all([
    waitingConversations(tenant.slug),
    activeConversations(tenant.slug),
    readChatAvailability(tenant.slug),
  ]);
  const activeWithAttendant = await Promise.all(
    active.map(async (conversation) => ({
      conversation,
      attendant: conversation.assignedUserId
        ? await attendantSummary(conversation.assignedUserId)
        : undefined,
    })),
  );
  const now = new Date();

  return (
    <>
      <AdminPageHeader title="Atendimento online" />
      <QueuePoller />
      <main className="flex flex-col gap-4.5 px-[30px] py-7">
        <div className="flex flex-wrap items-center gap-3.5 rounded-[14px] border border-admin-border bg-admin-card px-5 py-3.5">
          <h2 className="flex-1 font-serif text-[17px] font-semibold text-admin-primary">
            Atendimento online
          </h2>
          <span className="text-[12px] text-admin-muted">
            {active.length} conversas ativas
          </span>
          <StatusControl
            currentStatus={session.user.chatStatus ?? "available"}
          />
          <ChatToggle
            availability={availability}
            canToggle={can(session.user.role ?? "", "chat.settings")}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <section className="overflow-hidden rounded-[14px] border border-admin-border bg-admin-card">
            <div className="flex items-center gap-2 border-b border-admin-border px-4.5 py-3">
              <span className="font-bold text-[13.5px] text-admin-primary">
                Aguardando
              </span>
              <span className="rounded-full bg-admin-warning-bg px-2.5 py-0.5 text-[11px] font-bold text-admin-warning-text">
                {waiting.length}
              </span>
            </div>
            {waiting.length === 0 ? (
              <p className="px-4.5 py-6 text-center text-[13px] text-admin-muted">
                Ninguém esperando.
              </p>
            ) : (
              waiting.map((conversation) => {
                const minutes = waitMinutes(conversation.waitingSince, now);
                return (
                  <div
                    key={conversation.id}
                    className="flex items-center gap-3 border-b border-admin-border px-4.5 py-3 last:border-b-0"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-admin-text">
                        {conversation.citizenName}
                      </span>
                      <span className="block truncate text-[11.5px] text-admin-faint">
                        {conversation.subject}
                        {conversation.informedProtocolNumber
                          ? ` · ${conversation.informedProtocolNumber}`
                          : ""}
                      </span>
                    </span>
                    <span
                      className={`flex-none text-[12px] font-bold ${urgencyClass(minutes)}`}
                    >
                      {minutes} min
                    </span>
                    <AssignButton conversationId={conversation.id} />
                  </div>
                );
              })
            )}
          </section>

          <section className="overflow-hidden rounded-[14px] border border-admin-border bg-admin-card">
            <div className="flex items-center gap-2 border-b border-admin-border px-4.5 py-3">
              <span className="font-bold text-[13.5px] text-admin-primary">
                Em atendimento
              </span>
              <span className="rounded-full bg-admin-success-bg px-2.5 py-0.5 text-[11px] font-bold text-admin-success-text">
                {active.length}
              </span>
            </div>
            {activeWithAttendant.length === 0 ? (
              <p className="px-4.5 py-6 text-center text-[13px] text-admin-muted">
                Nenhuma conversa em atendimento.
              </p>
            ) : (
              activeWithAttendant.map(({ conversation, attendant }) => (
                <a
                  key={conversation.id}
                  href={`/admin/atendimento/${conversation.id}`}
                  className="flex items-center gap-3 border-b border-admin-border px-4.5 py-3 last:border-b-0 hover:bg-admin-input-bg"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-admin-text">
                      {conversation.citizenName}
                    </span>
                    <span className="block truncate text-[11.5px] text-admin-faint">
                      {attendant?.sector ?? conversation.subject}
                    </span>
                  </span>
                  {attendant && (
                    <span className="inline-flex flex-none items-center gap-1.5 rounded-full bg-admin-input-bg px-2.5 py-1 text-[11.5px] font-bold text-admin-primary">
                      {attendant.name}
                    </span>
                  )}
                </a>
              ))
            )}
          </section>
        </div>
      </main>
    </>
  );
}
