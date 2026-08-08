import Image from "next/image";
import Link from "next/link";
import { can, type Role } from "@/core/auth/roles.ts";

import type { Tenant } from "@/core/tenant/schema.ts";
import { signOut } from "../actions.ts";
import { AdminIcon } from "./icon.tsx";
import { ADMIN_NAV, navGroups } from "./nav.ts";
import { ROLE_LABELS } from "./role-labels.ts";

/**
 * Two letters for the avatar. Accounts born from an invite may have no name
 * yet, so the e-mail answers for them rather than leaving an empty circle.
 * Exported: the locked shell at /admin/redefinir-senha (see
 * locked-sidebar.tsx) shows the same avatar for a person who has no session
 * yet, only the account the invite or reset link names.
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

export function AdminSidebar({
  tenant,
  user,
  pathname,
  counts = {},
}: {
  tenant: Tenant;
  user: { name?: string | null; email: string; role: string };
  pathname: string;
  /** Badge count per item href, e.g. open requests for "/admin/pedidos". */
  counts?: Record<string, number>;
}) {
  // Hiding a link is a courtesy, not a gate: each route re-checks on the
  // server, so a person who types the URL still gets refused there.
  const items = ADMIN_NAV.filter(
    (item) => !item.permission || can(user.role, item.permission),
  );

  return (
    <aside className="flex w-[236px] flex-none flex-col bg-admin-primary">
      <div className="flex items-center gap-3 border-b border-white/12 px-[18px] py-5">
        <Image
          src={tenant.logos.seal.dark}
          alt=""
          width={36}
          height={36}
          className="h-9 w-9 flex-none object-contain"
        />
        <span className="min-w-0">
          <span className="block font-serif text-[15px] font-semibold leading-tight text-white">
            {tenant.name}
          </span>
          <span className="block text-[10.5px] uppercase tracking-[0.08em] text-admin-on-dark-subtitle">
            Painel administrativo
          </span>
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-3.5">
        {navGroups(items).map(({ group, items: groupItems }) => (
          <div key={group} className="flex flex-col gap-0.5">
            <span className="px-2.5 pt-3.5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-admin-on-dark-accent">
              {group}
            </span>
            {groupItems.map((item) => {
              const current = pathname === item.href;
              const count = counts[item.href];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  className={
                    current
                      ? "flex items-center gap-3 rounded-lg bg-white/13 px-2.5 py-2 text-[13px] font-semibold text-white"
                      : "flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium text-admin-on-dark-subtitle hover:bg-white/8 hover:text-white"
                  }
                >
                  <AdminIcon name={item.icon} className="h-4 w-4 flex-none" />
                  <span className="flex-1">{item.label}</span>
                  {Boolean(count) && (
                    <span className="inline-flex h-[19px] min-w-[19px] flex-none items-center justify-center rounded-full bg-admin-on-dark-accent px-1.5 text-[10.5px] font-bold text-admin-primary">
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/*
        The design also shows a "Trocar senha" shortcut here. It is not
        rendered yet: /admin/redefinir-senha is the invite screen and it
        redirects a signed in person straight back to /admin, so the shortcut
        would be a link that bounces. It joins this footer with the screen it
        belongs to, by the same rule that keeps the nav short above.
      */}
      <div className="flex items-center gap-2.5 border-t border-white/12 p-3.5">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-admin-on-dark-accent text-xs font-bold text-admin-primary">
          {initials(user.name, user.email)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-semibold text-white">
            {user.name?.trim() || user.email}
          </p>
          {/* A div, not a p: the sign out form lives here, and HTML does not
              allow a form inside a paragraph — React hydrates it wrong. */}
          <div className="flex items-center gap-1.5 text-[11px] text-admin-on-dark-subtitle">
            <span>{ROLE_LABELS[user.role as Role] ?? "Painel"}</span>
            <span aria-hidden="true">·</span>
            <form action={signOut}>
              <button type="submit" className="underline hover:text-white">
                Sair
              </button>
            </form>
          </div>
        </div>
      </div>
    </aside>
  );
}
