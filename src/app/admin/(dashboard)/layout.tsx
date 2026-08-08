import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { waitingCount } from "@/lib/chat.ts";
import { openRequestCount } from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
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
  const pathname = (await headers()).get("x-pathname") ?? "/admin";
  if (!session || !can(session.user.role ?? "", "admin.access")) {
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
    ...(can(role, "chat.manage")
      ? { "/admin/atendimento": await waitingCount(tenant.slug) }
      : {}),
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar
        tenant={tenant}
        user={{
          name: session.user.name,
          email: session.user.email,
          role,
        }}
        pathname={pathname}
        counts={counts}
      />
      {/*
        `h-screen overflow-hidden` above bounds the whole shell to the
        viewport so the sidebar never scrolls away; `overflow-y-auto` here is
        where an ordinary page's own length scrolls. A screen that manages
        its own internal scroll region (the chat conversation, see
        atendimento/[id]/page.tsx) fills this exactly instead and this div
        never actually overflows for it.
      */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
