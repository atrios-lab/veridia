import Image from "next/image";
import { can } from "@/core/auth/roles.ts";

import type { Tenant } from "@/core/tenant/schema.ts";
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
 * The navigation column. The person signed in used to have a footer here
 * (avatar, name, role, "Sair"); that moved to the top bar's user menu, so the
 * column is the office's seal and the navigation, nothing else.
 */
export function AdminSidebar({
  tenant,
  role,
  permissions,
  counts = {},
  showTutorials = true,
  className = "",
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
  /**
   * How this copy is laid out: the fixed column hides itself on a phone, the
   * drawer hides itself on a desktop. The bar itself is the same either way.
   */
  className?: string;
}) {
  // Hiding a link is a courtesy, not a gate: each route re-checks on the
  // server, so a person who types the URL still gets refused there. The
  // tutorials item is hidden for a different reason, nothing published
  // yet: the route answers either way, it just has nothing to show.
  const items = ADMIN_NAV.filter(
    (item) =>
      (!item.permission || can(role, item.permission, permissions)) &&
      !(item.href === "/admin/ajuda" && !showTutorials),
  );

  return (
    <aside
      className={`flex min-h-0 w-[236px] flex-none flex-col bg-admin-primary ${className}`}
    >
      <div className="border-b border-white/12 px-3 py-4">
        <div className="flex items-center gap-3 rounded-md border-l-[3px] border-admin-on-dark-accent bg-white/5 px-2.5 py-2.5 motion-safe:animate-brand-glow">
          <Image
            src={tenant.logos.seal.dark}
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 flex-none rounded-full object-contain ring-1 ring-admin-on-dark-accent/40"
          />
          <span className="min-w-0">
            <span className="block font-serif text-[13.5px] font-bold uppercase leading-snug tracking-[0.06em] text-white">
              {tenant.name}
            </span>
            <span className="mt-0.5 block text-[9.5px] font-extrabold uppercase tracking-[0.12em] whitespace-nowrap text-admin-on-dark-accent">
              Painel administrativo
            </span>
          </span>
        </div>
      </div>

      <AdminSidebarNav items={items} counts={counts} />
    </aside>
  );
}
