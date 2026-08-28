"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminIcon } from "./icon.tsx";
import { type AdminNavItem, navGroups } from "./nav.ts";

/**
 * The navigation list, on the client.
 *
 * The current item has to follow the navigation, and the layout that renders
 * this sidebar is shared by every panel screen: the App Router reuses it on a
 * client navigation instead of re-rendering it, so a path read from the
 * request (the `x-pathname` header) would stay the one from the first load
 * and the highlight would freeze on the screen the session started at.
 * `usePathname` is the path as it actually is right now.
 *
 * Only this list is a client component. Which items exist is still decided on
 * the server (see sidebar.tsx): what arrives here is already filtered by
 * permission.
 */
export function AdminSidebarNav({
  items,
  counts,
}: {
  items: readonly AdminNavItem[];
  /** Badge count per item href, e.g. open requests for "/admin/pedidos". */
  counts: Record<string, number>;
}) {
  const pathname = usePathname();

  return (
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
                // A named tab, not `_blank`: the mailbox is opened many
                // times a day, and a fresh tab per click buries the panel
                // by lunchtime.
                target={item.external ? "zoho" : undefined}
                rel={item.external ? "noreferrer" : undefined}
                className={
                  current
                    ? "flex items-center gap-3 rounded-lg bg-white/13 px-2.5 py-2 text-[13px] font-semibold text-white"
                    : "flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium text-admin-on-dark-subtitle hover:bg-white/8 hover:text-white"
                }
              >
                <AdminIcon name={item.icon} className="h-4 w-4 flex-none" />
                <span className="flex-1">{item.label}</span>
                {/*
                  The exit arrow takes the badge's place: an external item
                  never has a pending count to show there, and leaving the
                  panel unannounced is the surprise worth spending a glyph
                  on. The label carries the same fact for a screen reader,
                  which sees no arrow.
                */}
                {item.external && (
                  <>
                    <span aria-hidden="true" className="flex-none text-xs">
                      ↗
                    </span>
                    <span className="sr-only">(abre fora do painel)</span>
                  </>
                )}
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
  );
}
