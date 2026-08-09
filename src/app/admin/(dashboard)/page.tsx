import { can } from "@/core/auth/roles.ts";
import {
  countCriticalDeskItems,
  type DeskItemInput,
  rankDeskItems,
  rankTodayAppointments,
  type TodayAppointmentInput,
} from "@/core/overview/desk.ts";
import type { RequestKind } from "@/core/request/kinds.ts";
import { parseDetails } from "@/core/request/kinds.ts";
import { toIsoDate } from "@/core/scheduling/calendar.ts";
import {
  ACTIVITY_VERBS,
  type DeskRecord,
  findResumePoint,
  listDeskItems,
  listTodayAppointments,
  type TodayAppointmentRecord,
} from "@/lib/admin-overview.ts";
import { isChatEnabled, waitingConversations } from "@/lib/chat.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, OFFICE_TIME_ZONE, today } from "@/lib/tenant.ts";
import type { ActionShortcut } from "./_components/action-shortcuts.tsx";
import { ActionShortcuts } from "./_components/action-shortcuts.tsx";
import type { ChannelStatusRow } from "./_components/channel-status.tsx";
import { ChannelStatus } from "./_components/channel-status.tsx";
import { DeskList } from "./_components/desk-list.tsx";
import { KeyboardShortcutsCard } from "./_components/keyboard-shortcuts-card.tsx";
import { LiveChatCard } from "./_components/live-chat-card.tsx";
import { OverviewHeader } from "./_components/overview-header.tsx";
import { ResumeCard } from "./_components/resume-card.tsx";
import { TodayAgenda } from "./_components/today-agenda.tsx";

export const metadata = { title: "Painel" };

const ROUTE_BY_KIND: Record<RequestKind, string> = {
  "service-request": "/admin/pedidos",
  appointment: "/admin/agenda",
  "data-rights": "/admin/lgpd",
  ombudsman: "/admin/ouvidoria",
};

const CHANNEL_STATUS_LABELS: Record<RequestKind, string> = {
  "service-request": "pedidos de serviço em aberto",
  "data-rights": "requerimentos LGPD em aberto",
  ombudsman: "manifestações na Ouvidoria",
  appointment: "horários aguardando ação",
};

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "numeric",
      hour12: false,
      timeZone: OFFICE_TIME_ZONE,
    }).format(new Date()),
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function firstName(name: string | null | undefined, email: string): string {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first || email;
}

function officeHour(instant: Date): number {
  return Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "numeric",
      hour12: false,
      timeZone: OFFICE_TIME_ZONE,
    }).format(instant),
  );
}

function toDeskItemInput(record: DeskRecord): DeskItemInput {
  const base = {
    kind: record.kind,
    protocolNumber: record.protocolNumber,
    applicantName: record.applicantName,
    status: record.status,
    createdAt: record.createdAt,
  };
  switch (record.kind) {
    case "data-rights": {
      const details = parseDetails("data-rights", record.details);
      return {
        ...base,
        requestedOn: toIsoDate(record.createdAt, OFFICE_TIME_ZONE),
        right: details.right,
      };
    }
    case "service-request":
      return {
        ...base,
        hasFulfilledPendingRequirement: record.hasFulfilledPendingRequirement,
      };
    case "appointment": {
      const details = parseDetails("appointment", record.details);
      return {
        ...base,
        appointmentDate: details.date,
        slotHour: details.slotHour,
        subject: details.subject,
      };
    }
    case "ombudsman": {
      const details = parseDetails("ombudsman", record.details);
      return { ...base, manifestationType: details.manifestationType };
    }
  }
}

function toTodayAppointmentInput(
  record: TodayAppointmentRecord,
): TodayAppointmentInput {
  const details = parseDetails("appointment", record.details);
  return {
    protocolNumber: record.protocolNumber,
    applicantName: record.applicantName,
    subject: details.subject,
    slotHour: details.slotHour,
    status: record.status,
  };
}

export default async function AdminHome() {
  const session = await getSession();
  if (!session) return null;
  const tenant = await getTenant();
  const role = session.user.role ?? "";

  const canRequests = can(role, "requests.manage");
  const canChannels = can(role, "channels.manage");
  const canPublish = can(role, "content.edit");
  const canChat = can(role, "chat.manage");
  const kinds: RequestKind[] = [
    ...(canRequests ? (["service-request"] as const) : []),
    // Same order the sidebar's "Canais do cidadão" group lists them in
    // (nav.ts): LGPD, Ouvidoria, Agenda. "Situação dos canais" reads this
    // order directly.
    ...(canChannels
      ? (["data-rights", "ombudsman", "appointment"] as const)
      : []),
  ];

  const todayIso = today();
  const [deskRecords, todayAppointmentRecords, resumePoint, waitingChat] =
    await Promise.all([
      listDeskItems(tenant.slug, kinds),
      canChannels
        ? listTodayAppointments(tenant.slug, todayIso)
        : Promise.resolve([]),
      findResumePoint(tenant.slug, session.user.id),
      canChat
        ? Promise.all([
            isChatEnabled(tenant.slug),
            waitingConversations(tenant.slug),
          ])
        : Promise.resolve([false, []] as const),
    ]);

  const now = new Date();
  const deskItems = deskRecords.map(toDeskItemInput);
  const rankedDesk = rankDeskItems(deskItems, todayIso, now);
  const criticalCount = countCriticalDeskItems(deskItems, todayIso);
  const rankedAgenda = rankTodayAppointments(
    todayAppointmentRecords.map(toTodayAppointmentInput),
    officeHour(now),
  );

  const [chatEnabled, waiting] = waitingChat;
  const nextWaiting = waiting[0];

  const pendingConfirmCount = deskRecords.filter(
    (record) =>
      record.kind === "appointment" &&
      (record.status === "requested" || record.status === "proposed"),
  ).length;

  const shortcuts: ActionShortcut[] = [
    ...(canRequests
      ? [
          {
            key: "novo-pedido",
            href: "/admin/pedidos/novo",
            icon: "plus" as const,
            title: "Novo pedido no balcão",
            caption: "tecla N",
          },
        ]
      : []),
    ...(canChannels
      ? [
          {
            key: "confirmar-horario",
            href: "/admin/agenda",
            icon: "checkCircle" as const,
            title: "Confirmar horário",
            caption:
              pendingConfirmCount > 0
                ? `${pendingConfirmCount} pendente${pendingConfirmCount === 1 ? "" : "s"}`
                : "nenhum pendente",
          },
        ]
      : []),
    ...(canPublish
      ? [
          {
            key: "nova-publicacao",
            href: "/admin/publicacoes",
            icon: "file" as const,
            title: "Nova publicação",
            caption: "edital ou aviso",
          },
        ]
      : []),
  ];

  const countByKind = new Map<RequestKind, number>();
  for (const record of deskRecords) {
    countByKind.set(record.kind, (countByKind.get(record.kind) ?? 0) + 1);
  }
  const channelRows: ChannelStatusRow[] = kinds.map((kind) => ({
    kind,
    label: CHANNEL_STATUS_LABELS[kind],
    count: countByKind.get(kind) ?? 0,
    critical: kind === "data-rights" && criticalCount > 0,
  }));

  return (
    <>
      <OverviewHeader
        greeting={`${greeting()}, ${firstName(session.user.name, session.user.email)}`}
        deskCount={deskItems.length}
        criticalCount={criticalCount}
        today={todayIso}
      />
      <main className="flex flex-col gap-4.5 px-[30px] py-7">
        <ActionShortcuts shortcuts={shortcuts} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_348px] lg:items-start">
          <div className="flex min-w-0 flex-col gap-4">
            <DeskList items={rankedDesk} />
            {canChannels && <TodayAgenda appointments={rankedAgenda} />}
          </div>

          <div className="flex flex-col gap-4">
            {canChat && chatEnabled && nextWaiting && (
              <LiveChatCard
                citizenName={nextWaiting.citizenName}
                subject={nextWaiting.subject}
                waitMinutes={Math.floor(
                  (now.getTime() - nextWaiting.waitingSince.getTime()) / 60_000,
                )}
              />
            )}

            {resumePoint && (
              <ResumeCard
                protocolNumber={resumePoint.protocolNumber}
                description={`Você ${ACTIVITY_VERBS[resumePoint.action] ?? "agiu neste item"}`}
                href={`${ROUTE_BY_KIND[resumePoint.kind]}/${encodeURIComponent(resumePoint.protocolNumber)}`}
              />
            )}

            <ChannelStatus rows={channelRows} />
            <KeyboardShortcutsCard />
          </div>
        </div>
      </main>
    </>
  );
}
