import Image from "next/image";
import { can, type Permission } from "@/core/auth/roles.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { Sidebar, SidebarHeader, SidebarRail } from "../_ui/sidebar.tsx";
import { ADMIN_NAV } from "./nav.ts";
import { AdminSidebarNav } from "./sidebar-nav.tsx";

/**
 * Two letters for the avatar. Accounts born from an invite may have no name
 * yet, so the e-mail answers for them rather than leaving an empty circle.
 * Exported: the top bar's user menu (see top-bar.tsx) and the locked shell
 * at /admin/redefinir-senha (see locked-sidebar.tsx) show the same avatar.
 */
export function initials(
  name: string | null | undefined,
  email: string,
): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words.at(-1)?.[0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

/**
 * The office in the panel: its seal and its name, the only place the office
 * shows up in the panel's chrome (painel-neutro-shadcn). The seal for a
 * light background, since the sidebar is light. The name folds away when
 * the sidebar collapses to its icons, and the seal stays.
 */
export function OfficeMark({ tenant }: { tenant: Tenant }) {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <Image
        src={tenant.logos.seal.light}
        alt=""
        width={32}
        height={32}
        className="size-8 flex-none object-contain"
      />
      <span className="min-w-0 group-data-[collapsible=icon]:hidden">
        <span className="block text-sm leading-tight font-semibold text-sidebar-foreground">
          {tenant.name}
        </span>
        <span className="mt-0.5 block text-xs text-sidebar-label">
          Painel administrativo
        </span>
      </span>
    </div>
  );
}

/**
 * The navigation column: the office's seal and the navigation, nothing else.
 * The person signed in lives in the top bar's user menu. On a phone the same
 * column opens as a drawer from the top bar's menu button.
 */
export function AdminSidebar({
  tenant,
  role,
  permissions,
  counts = {},
  showTutorials = true,
}: {
  tenant: Tenant;
  /** The session's role: decides which items are offered. */
  role: string;
  /** The session's effective permissions (the Tabelião's choices). */
  permissions?: readonly string[];
  /** Badge count per item href, e.g. open requests for "/admin/pedidos". */
  counts?: Record<string, number>;
  /** Whether "Treinamento" has somewhere to lead: a published video, or
   * the management screen for the account that can reach it. */
  showTutorials?: boolean;
}) {
  // Hiding a link is a courtesy, not a gate: each route re-checks on the
  // server, so a person who types the URL still gets refused there. The
  // tutorials item is hidden for a different reason, nothing published
  // yet: the route answers either way, it just has nothing to show.
  const allowed = (permission?: Permission) =>
    !permission || can(role, permission, permissions);
  const items = ADMIN_NAV.filter(
    (item) =>
      allowed(item.permission) &&
      !(item.href === "/admin/ajuda" && !showTutorials),
  ).map((item) =>
    item.children
      ? {
          ...item,
          children: item.children.filter((child) => allowed(child.permission)),
        }
      : item,
  );

  return (
    <Sidebar collapsible="icon" variant="inset">
      {/* 56px, the top bar's height. The inset variant (shadcn): the
          sidebar's colour frames the screen and the content sits in a
          card on it, see the dashboard layout. */}
      <SidebarHeader className="h-14 flex-none justify-center py-0">
        <OfficeMark tenant={tenant} />
      </SidebarHeader>
      <AdminSidebarNav items={items} counts={counts} />
      <SidebarRail />
    </Sidebar>
  );
}
