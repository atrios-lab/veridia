import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { sendDueRemindersInBackground } from "@/lib/appointment-reminders.ts";
import { bookedCountFrom } from "@/lib/appointments.ts";
import {
  openNotificationCountWith,
  pendingUrgentCountWith,
} from "@/lib/audit-trail.ts";
import { waitingCount } from "@/lib/chat.ts";
import { openGuideRequestCount } from "@/lib/guide-requests.ts";
import { getOfficeAlerts } from "@/lib/office-alerts.ts";
import { openCountByKind, openRequestCount } from "@/lib/service-request.ts";
import { getPendingSession, getSession } from "@/lib/session.ts";
import { getTenant, officeNow } from "@/lib/tenant.ts";
import { publishedTutorialCount } from "@/lib/tutorials.ts";
import { MenuPopover } from "../../_components/menu-popover.tsx";
import { AgendaAlerts } from "../_components/agenda-alerts.tsx";
import {
  CHAT_SHAKE_TARGET_ID,
  ChatAlerts,
} from "../_components/chat-alerts.tsx";
import { GlobalSearchProvider } from "../_components/global-search.tsx";
import { GuideAlerts } from "../_components/guide-alerts.tsx";
import { RecordAlerts } from "../_components/record-alerts.tsx";
import { ShortcutListener } from "../_components/shortcut-listener.tsx";
import { AdminSidebar } from "../_components/sidebar.tsx";
import { ADMIN_MENU_ID, AdminTopBar } from "../_components/top-bar.tsx";
import { UrgentAuditBanner } from "../_components/urgent-audit-banner.tsx";

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
  const urgentPending = can(role, "audit.manage", granted)
    ? await pendingUrgentCountWith(db, tenant.slug, session.user.id).catch(
        () => 0,
      )
    : 0;
  const counts: Record<string, number> = {
    // Notifications of the audit waiting for this person's answer, and the
    // urgent acts waiting for the holder's look.
    "/admin/auditoria":
      (await openNotificationCountWith(db, tenant.slug, session.user.id).catch(
        () => 0,
      )) + urgentPending,
    ...(can(role, "requests.manage", granted)
      ? {
          "/admin/pedidos": await openRequestCount(tenant.slug),
          // The guias de recolhimento the site asked for, still open.
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
  };

  // Backup for the daily reminders job (api/agenda/lembretes): opening the
  // panel sends whatever is due, after the response, once each.
  if (can(role, "channels.manage", granted)) {
    after(() => sendDueRemindersInBackground(tenant, officeNow()));
  }

  // "Treinamento" is offered once there is something to watch, and always
  // to the platform account, for whom it is the way to the management
  // screen. Hiding it is the courtesy; the route answers either way.
  const showTutorials =
    can(role, "tutorials.manage", granted) ||
    (await publishedTutorialCount()) > 0;

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
      {/* `id` is what the chat alert shakes (see chat-alerts.tsx). */}
      <div id={CHAT_SHAKE_TARGET_ID} className="flex h-screen overflow-hidden">
        <AdminSidebar
          tenant={tenant}
          role={role}
          permissions={granted}
          counts={counts}
          showTutorials={showTutorials}
          className="hidden md:flex"
        />

        {/*
          The same bar as a drawer, for a screen with no room to spare: 236px
          of a 375px phone was the panel's whole navigation sitting on top of
          the work. Native popover, the way the public site's menu does it, so
          it opens before hydration and the browser handles Escape, the tap
          outside and the backdrop. The button that opens it lives in the page
          header (see ../../_components/page-header.tsx): `popovertarget`
          matches by id, anywhere in the document.
        */}
        <div
          id={ADMIN_MENU_ID}
          popover="auto"
          // `right-auto w-fit` is load bearing: a popover inherits `inset: 0`
          // from the UA sheet, so without them the box spans the whole width
          // and the empty space beside the bar counts as inside it. The tap
          // meant to dismiss would land on the popover and do nothing, which
          // is the very complaint this fixes.
          className="inset-y-0 right-auto left-0 m-0 h-full w-fit max-w-none border-0 bg-transparent p-0 backdrop:bg-black/40 md:hidden"
        >
          <AdminSidebar
            tenant={tenant}
            role={role}
            permissions={granted}
            counts={counts}
            className="h-full"
          />
          <MenuPopover />
        </div>
        {/*
          `h-screen overflow-hidden` above bounds the whole shell to the
          viewport so the sidebar never scrolls away; `overflow-y-auto` here is
          where an ordinary page's own length scrolls. A screen that manages
          its own internal scroll region (the chat conversation, see
          atendimento/[id]/page.tsx) fills this exactly instead and this div
          never actually overflows for it.

          The top bar sits inside this column, above the page: one bar for
          every screen, rendered here rather than by each page, which is what
          let the screens' own headers shrink to a title (see page-header.tsx).

          `relative` is load bearing too: a `sr-only` span is absolutely
          positioned, and without a positioned ancestor its containing block
          is the document, so one sitting below the fold of a long table (the
          pagination arrows have them) stretches the page past the shell and
          the whole panel scrolls away under the wheel. Positioned here, they
          belong to this column and its overflow clips them.
        */}
        <div className="scrollbar-hidden relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
          <AdminTopBar user={user} />
          {urgentPending > 0 && <UrgentAuditBanner count={urgentPending} />}
          {children}
          {/* Every screen, not only the queue: the attendant hears and sees
              the chat wherever they are working in the panel. */}
          {can(role, "chat.manage", granted) && (
            <ChatAlerts setting={alerts.chat} />
          )}
          {/* Same for the agenda: who is coming today, who just booked. */}
          {can(role, "channels.manage", granted) && (
            <AgendaAlerts setting={alerts.agenda} />
          )}
          {/* And the guias de recolhimento: a new one, or one the citizen moved. */}
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
      </div>
    </GlobalSearchProvider>
  );
}
