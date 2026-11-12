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
import { Badge } from "../../_ui/badge.tsx";
import { AlertSettings } from "./_components/alert-settings.tsx";
import { AssignButton } from "./_components/assign-button.tsx";
import { ChatToggle } from "./_components/chat-toggle.tsx";
import { QueuePoller } from "./_components/queue-poller.tsx";
import { StatusControl } from "./_components/status-control.tsx";
import { WaitingTime } from "./_components/waiting-time.tsx";

export const metadata = { title: "Atendimento online" };

export default async function SupportChatQueuePage() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "chat.manage", session.user.permissions)
  )
    notFound();

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
  const queueVersion = `${waiting.map((c) => c.id).join(",")}|${active.map((c) => c.id).join(",")}`;

  return (
    <>
      <AdminPageHeader title="Atendimento online" />
      <QueuePoller version={queueVersion} />
      <main className="flex flex-col gap-6 px-4 pt-6 pb-8 md:px-8">
        <div className="flex flex-wrap items-center gap-3.5 rounded-xl border bg-card px-5 py-3.5 shadow-xs">
          <h2 className="flex-1 text-lg font-semibold text-foreground">
            Atendimento online
          </h2>
          <span className="text-xs text-muted-foreground">
            {active.length} conversas ativas
          </span>
          <StatusControl
            currentStatus={session.user.chatStatus ?? "available"}
          />
          <ChatToggle
            availability={availability}
            canToggle={can(
              session.user.role ?? "",
              "chat.settings",
              session.user.permissions,
            )}
          />
        </div>

        <AlertSettings />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
            <div className="flex items-center gap-2 border-b px-4.5 py-3">
              <span className="text-sm font-semibold text-foreground">
                Aguardando
              </span>
              <Badge className="bg-warning text-warning-foreground tabular-nums">
                {waiting.length}
              </Badge>
            </div>
            {waiting.length === 0 ? (
              <p className="px-4.5 py-6 text-center text-sm text-muted-foreground">
                Ninguém esperando.
              </p>
            ) : (
              <div className="divide-y">
                {waiting.map((conversation) => (
                  <div
                    key={conversation.id}
                    className="flex items-center gap-3 px-4.5 py-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {conversation.citizenName}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {conversation.subject}
                        {conversation.informedProtocolNumber
                          ? ` · ${conversation.informedProtocolNumber}`
                          : ""}
                      </span>
                    </span>
                    <WaitingTime
                      waitingSince={conversation.waitingSince.toISOString()}
                    />
                    <AssignButton conversationId={conversation.id} />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
            <div className="flex items-center gap-2 border-b px-4.5 py-3">
              <span className="text-sm font-semibold text-foreground">
                Em atendimento
              </span>
              <Badge className="bg-success text-success-foreground tabular-nums">
                {active.length}
              </Badge>
            </div>
            {activeWithAttendant.length === 0 ? (
              <p className="px-4.5 py-6 text-center text-sm text-muted-foreground">
                Nenhuma conversa em atendimento.
              </p>
            ) : (
              <div className="divide-y">
                {activeWithAttendant.map(({ conversation, attendant }) => (
                  <a
                    key={conversation.id}
                    href={`/admin/atendimento/${conversation.id}`}
                    className="flex items-center gap-3 px-4.5 py-3 transition-colors hover:bg-muted/50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {conversation.citizenName}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {attendant?.sector ?? conversation.subject}
                      </span>
                    </span>
                    {attendant && (
                      <Badge variant="secondary" className="flex-none">
                        {attendant.name}
                      </Badge>
                    )}
                  </a>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
