import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { closesAt } from "@/core/auth/access-hours.ts";
import { can } from "@/core/auth/roles.ts";
import { STATUS_LABELS } from "@/core/messages/rules.ts";
import { db } from "@/db/index.ts";
import { getAccessHours } from "@/lib/access-hours.ts";
import { sendDueRemindersInBackground } from "@/lib/appointment-reminders.ts";
import { bookedCountFrom } from "@/lib/appointments.ts";
import {
  openNotificationCountWith,
  pendingUrgentCountWith,
} from "@/lib/audit-trail.ts";
import { waitingCount } from "@/lib/chat.ts";
import { openGuideRequestCount } from "@/lib/guide-requests.ts";
import {
  getProfileWith,
  inboxWith,
  lingeringStatusesWith,
} from "@/lib/messages.ts";
import { getOfficeAlerts } from "@/lib/office-alerts.ts";
import { pendingDutyCount } from "@/lib/security-paper.ts";
import { sendSecurityPaperRemindersInBackground } from "@/lib/security-paper-reminders.ts";
import { openCountByKind, openRequestCount } from "@/lib/service-request.ts";
import {
  getClosedHoursSession,
  getPendingSession,
  getSession,
} from "@/lib/session.ts";
import { getTenant, officeNow } from "@/lib/tenant.ts";
import { publishedTutorialCount } from "@/lib/tutorials.ts";
import { AccessClosed } from "../_components/access-closed.tsx";
import { AccessHoursWatch } from "../_components/access-hours-watch.tsx";
import { AgendaAlerts } from "../_components/agenda-alerts.tsx";
import {
  CHAT_SHAKE_TARGET_ID,
  ChatAlerts,
} from "../_components/chat-alerts.tsx";
import { GlobalSearchProvider } from "../_components/global-search.tsx";
import { GuideAlerts } from "../_components/guide-alerts.tsx";
import { MessengerWatch } from "../_components/messenger-watch.tsx";
import { RecordAlerts } from "../_components/record-alerts.tsx";
import { ShortcutListener } from "../_components/shortcut-listener.tsx";
import { AdminSidebar } from "../_components/sidebar.tsx";
import { AdminTopBar } from "../_components/top-bar.tsx";
import {
  AccessRequestsBanner,
  AuditChime,
  AuditNoticeBanner,
  LingeringStatusBanner,
  UrgentAuditBanner,
} from "../_components/urgent-audit-banner.tsx";
import { SidebarProvider } from "../_ui/sidebar.tsx";
import { TooltipProvider } from "../_ui/tooltip.tsx";

// The protected skeleton. The check runs on every request and hits the
// database, so a session revoked there is gone on the next navigation.
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // getSession already refuses a session from another office, so what is
  // left here is the role. Both conditions still have to hold, and they stay
  // separate: an admin is an admin of their own office, never of the one
  // whose domain they happened to open.
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "admin.access", session.user.permissions)
  ) {
    // Outside the panel's hours and not released by the holder: the closed
    // screen, with the way to ask for a release (decision of 11/11/2026).
    const closed = await getClosedHoursSession();
    if (closed) {
      const [tenant, hours] = await Promise.all([
        getTenant(),
        getAccessHours(closed.user.tenantSlug ?? ""),
      ]);
      return (
        <AccessClosed
          seal={tenant.logos.seal.light}
          officeName={tenant.name}
          personName={closed.user.name}
          start={hours.start}
          end={hours.end}
          pending={hours.requests.some((r) => r.userId === closed.user.id)}
        />
      );
    }
    const pathname = (await headers()).get("x-pathname") ?? "/admin";
    // Password right, e-mail code still missing: the second step, not the
    // login again (lib/access-code.ts).
    if (!session && (await getPendingSession())) {
      redirect(`/admin/acesso?${new URLSearchParams({ next: pathname })}`);
    }
    // The middleware already sent anyone with no session cookie at all to
    // the login page before this ever runs (see src/middleware.ts), so
    // reaching here means a cookie existed and this database check is what
    // rejected it. That is what "sua sessão terminou" is allowed to claim.
    const query = new URLSearchParams({ next: pathname, motivo: "expirada" });
    redirect(`/admin/login?${query}`);
  }

  const tenant = await getTenant();
  const role = session.user.role ?? "";
  const granted = session.user.permissions;
  // How the office wants each channel to call (Configurações › Notificações).
  const alerts = await getOfficeAlerts(tenant.slug);
  // Only queried when the item is actually offered: the badge is a courtesy
  // on top of a link that is itself hidden without the permission.
  // Urgent acts the Tabelião/Registrador has not marked as seen yet: the
  // alert stays on every screen until he does (decision of 11/11/2026).
  const hours = await getAccessHours(tenant.slug);
  const accessRequests = can(role, "access.manage", granted)
    ? hours.requests.length
    : 0;
  const hoursEnd = closesAt(hours, role, session.user.id, new Date());
  // Away for 40 minutes or more: the holder checks (decision of 11/11/2026).
  const lingeringNow = can(role, "audit.manage", granted)
    ? await lingeringStatusesWith(db, tenant.slug).catch(() => [])
    : [];
  const urgentPending = can(role, "audit.manage", granted)
    ? await pendingUrgentCountWith(db, tenant.slug, session.user.id).catch(
        () => 0,
      )
    : 0;
  // Audit notifications waiting for this person's answer: a warning on
  // every screen until answered (decision of 11/11/2026).
  const myNotifications = await openNotificationCountWith(
    db,
    tenant.slug,
    session.user.id,
  ).catch(() => 0);
  // The internal messenger: unread for the badge, the sound choice for
  // the watcher that rings on every screen.
  const messenger = can(role, "desk.access", granted)
    ? await Promise.all([
        inboxWith(db, session.user.id, new Date()),
        getProfileWith(db, tenant.slug, session.user.id),
      ]).catch(() => null)
    : null;
  const counts: Record<string, number> = {
    "/admin/mensagens": messenger?.[0].unread ?? 0,
    // Notifications of the audit waiting for this person's answer, and the
    // urgent acts waiting for the holder's look.
    "/admin/auditoria": myNotifications + urgentPending,
    ...(can(role, "requests.manage", granted)
      ? {
          "/admin/pedidos": await openRequestCount(tenant.slug),
          // The guias de transmissão de bens the site asked for, still open.
          "/admin/utilitarios/guias": await openGuideRequestCount(tenant.slug),
        }
      : {}),
    ...(can(role, "channels.manage", granted)
      ? {
          "/admin/lgpd": await openCountByKind(tenant.slug, "data-rights"),
          "/admin/ouvidoria": await openCountByKind(tenant.slug, "ombudsman"),
          // Appointments still ahead, from today on: the agenda moved to
          // its own table, and the old count read the retired kind.
          "/admin/agenda": await bookedCountFrom(tenant.slug, officeNow().date),
        }
      : {}),
    ...(can(role, "chat.manage", granted)
      ? { "/admin/atendimento": await waitingCount(tenant.slug) }
      : {}),
    // The quarter's accounts and the month's losses owed to the
    // Corregedoria (decision of 11/11/2026).
    ...(can(role, "security-paper.manage", granted)
      ? {
          "/admin/utilitarios/papel-seguranca": await pendingDutyCount(
            tenant,
            officeNow().date,
          ),
        }
      : {}),
  };

  // Backup for the daily reminders job (api/agenda/lembretes): opening the
  // panel sends whatever is due, after the response, once each.
  if (can(role, "channels.manage", granted)) {
    after(() => sendDueRemindersInBackground(tenant, officeNow()));
  }
  if (can(role, "security-paper.manage", granted)) {
    after(() =>
      sendSecurityPaperRemindersInBackground(tenant, officeNow().date),
    );
  }

  // "Treinamento" is offered once there is something to watch, and always
  // to the platform account, for whom it is the way to the management
  // screen. Hiding it is the courtesy; the route answers either way.
  const showTutorials =
    can(role, "tutorials.manage", granted) ||
    (await publishedTutorialCount()) > 0;

  // Open unless the person collapsed it last time (the cookie the sidebar
  // writes, see _ui/sidebar.tsx).
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false";

  const user = {
    name: session.user.name,
    email: session.user.email,
    role,
    permissions: granted,
  };

  return (
    <GlobalSearchProvider>
      <ShortcutListener
        canRequests={can(role, "requests.manage", granted)}
        canChannels={can(role, "channels.manage", granted)}
      />
      <TooltipProvider>
        {/* `id` is what the chat alert shakes (see chat-alerts.tsx). The
            shell is bounded to the viewport: the sidebar never scrolls away,
            and the column on its right is where a page's own length
            scrolls. A screen that manages its own internal scroll region
            (the chat conversation, see atendimento/[id]/page.tsx) fills
            that column exactly instead. The sidebar remembers whether it
            was collapsed, in a cookie the server reads here. */}
        <SidebarProvider
          id={CHAT_SHAKE_TARGET_ID}
          defaultOpen={sidebarOpen}
          // --content-left: where the content column starts, for the alerts
          // that float at its left edge (agenda-alerts, record-alerts). It
          // follows the sidebar when it collapses to its icons.
          className="h-svh min-h-0 overflow-hidden [--content-left:var(--sidebar-width)] has-[[data-slot=sidebar][data-state=collapsed]]:[--content-left:var(--sidebar-width-icon)]"
        >
          <AdminSidebar
            tenant={tenant}
            role={role}
            permissions={granted}
            counts={counts}
            showTutorials={showTutorials}
          />
          {/*
            `relative` is load bearing: a `sr-only` span is absolutely
            positioned, and without a positioned ancestor its containing
            block is the document, so one sitting below the fold of a long
            table stretches the page past the shell and the whole panel
            scrolls away under the wheel. Positioned here, they belong to
            this column and its overflow clips them.
          */}
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-surface">
            <AdminTopBar user={user} />
            {urgentPending > 0 && <UrgentAuditBanner count={urgentPending} />}
            {lingeringNow.length > 0 && (
              <LingeringStatusBanner
                people={lingeringNow.map((p) => ({
                  name: p.name,
                  status: STATUS_LABELS[p.status],
                  minutes: Math.floor(
                    (Date.now() - p.since.getTime()) / 60_000,
                  ),
                }))}
              />
            )}
            {accessRequests > 0 && (
              <AccessRequestsBanner count={accessRequests} />
            )}
            {hoursEnd && <AccessHoursWatch closesAt={hoursEnd.toISOString()} />}
            {myNotifications > 0 && (
              <AuditNoticeBanner count={myNotifications} />
            )}
            {alerts.auditoria.enabled &&
              urgentPending + myNotifications > 0 && (
                <AuditChime
                  count={urgentPending + myNotifications}
                  setting={alerts.auditoria}
                />
              )}
            {children}
            {/* Off, or at lunch (the chat is locked until "voltei"). */}
            {messenger &&
              !messenger[1]?.chatDisabled &&
              !messenger[1]?.atLunch && (
                <MessengerWatch
                  setting={alerts.mensagens}
                  sound={messenger[1]?.sound ?? true}
                  initialUnread={messenger[0].unread}
                />
              )}
            {/* Every screen, not only the queue: the attendant hears and sees
              the chat wherever they are working in the panel. */}
            {can(role, "chat.manage", granted) && (
              <ChatAlerts setting={alerts.chat} />
            )}
            {/* Same for the agenda: who is coming today, who just booked. */}
            {can(role, "channels.manage", granted) && (
              <AgendaAlerts setting={alerts.agenda} />
            )}
            {/* And the guias de transmissão de bens: a new one, or one the citizen moved. */}
            {can(role, "requests.manage", granted) && (
              <GuideAlerts setting={alerts.guias} />
            )}
            {/* New requests, LGPD and ouvidoria, each as the office chose. */}
            {(can(role, "requests.manage", granted) ||
              can(role, "channels.manage", granted)) && (
              <RecordAlerts
                settings={{
                  pedidos: alerts.pedidos,
                  lgpd: alerts.lgpd,
                  ouvidoria: alerts.ouvidoria,
                }}
              />
            )}
          </div>
        </SidebarProvider>
      </TooltipProvider>
    </GlobalSearchProvider>
  );
}
