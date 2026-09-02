import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { waitingCount } from "@/lib/chat.ts";
import { openCountByKind, openRequestCount } from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { MenuPopover } from "../../_components/menu-popover.tsx";
import { GlobalSearchProvider } from "../_components/global-search.tsx";
import { ADMIN_MENU_ID } from "../_components/page-header.tsx";
import { ShortcutListener } from "../_components/shortcut-listener.tsx";
import { AdminSidebar } from "../_components/sidebar.tsx";

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
  if (!session || !can(session.user.role ?? "", "admin.access")) {
    const pathname = (await headers()).get("x-pathname") ?? "/admin";
    // The middleware already sent anyone with no session cookie at all to
    // the login page before this ever runs (see src/middleware.ts), so
    // reaching here means a cookie existed and this database check is what
    // rejected it. That is what "sua sessão terminou" is allowed to claim.
    const query = new URLSearchParams({ next: pathname, motivo: "expirada" });
    redirect(`/admin/login?${query}`);
  }

  const tenant = await getTenant();
  const role = session.user.role ?? "";
  // Only queried when the item is actually offered: the badge is a courtesy
  // on top of a link that is itself hidden without the permission.
  const counts: Record<string, number> = {
    ...(can(role, "requests.manage")
      ? { "/admin/pedidos": await openRequestCount(tenant.slug) }
      : {}),
    ...(can(role, "channels.manage")
      ? {
          "/admin/lgpd": await openCountByKind(tenant.slug, "data-rights"),
          "/admin/ouvidoria": await openCountByKind(tenant.slug, "ombudsman"),
          "/admin/agenda": await openCountByKind(tenant.slug, "appointment"),
        }
      : {}),
    ...(can(role, "chat.manage")
      ? { "/admin/atendimento": await waitingCount(tenant.slug) }
      : {}),
  };

  const user = {
    name: session.user.name,
    email: session.user.email,
    role,
  };

  return (
    <GlobalSearchProvider>
      <ShortcutListener
        canRequests={can(role, "requests.manage")}
        canChannels={can(role, "channels.manage")}
      />
      <div className="flex h-screen overflow-hidden">
        <AdminSidebar
          tenant={tenant}
          user={user}
          counts={counts}
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
            user={user}
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
        */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
          {children}
        </div>
      </div>
    </GlobalSearchProvider>
  );
}
