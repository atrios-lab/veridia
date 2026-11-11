"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ATTENTION_CLASS } from "./attention.ts";
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
  const groups = navGroups(items);
  // Every group open, always (decision of 11/11/2026): with the groups
  // folded, people could not find the screens. The titles only organize.

  return (
    <nav className="relative flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
      {groups.map(({ group, items: groupItems }, index) => {
        const listId = `nav-${index}`;
        return (
          <section
            key={group}
            aria-labelledby={`${listId}-title`}
            className="flex flex-col"
          >
            {/* The groups' titles stand out (decision of 11/11/2026): a
                larger, heavier label with a gold bar. */}
            <h2
              id={`${listId}-title`}
              className="mt-1 rounded-md border-l-[3px] border-admin-on-dark-accent bg-white/5 px-2.5 py-2 text-[11.5px] font-extrabold uppercase tracking-[0.12em] text-admin-on-dark-accent"
            >
              {group}
            </h2>
            <div className="mt-1 flex flex-col gap-px">
              {groupItems.map((item) => {
                const current = pathname === item.href;
                const count = counts[item.href];
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    // A named tab, not `_blank`: the mailbox is opened many
                    // times a day, and a fresh tab per click buries the
                    // panel by lunchtime.
                    target={item.external ? "zoho" : undefined}
                    rel={item.external ? "noreferrer" : undefined}
                    // An `attention` item calls until the person answers
                    // it: on its own screen it is just the current item.
                    className={
                      current
                        ? "flex items-center gap-2.5 rounded-lg bg-white/13 px-2.5 py-1.5 text-[13px] font-semibold text-white"
                        : item.attention
                          ? `flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] ${ATTENTION_CLASS}`
                          : "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-admin-on-dark-subtitle hover:bg-white/8 hover:text-white"
                    }
                  >
                    <AdminIcon name={item.icon} className="h-4 w-4 flex-none" />
                    <span className="flex-1 leading-tight">{item.label}</span>
                    {/*
                      The exit arrow takes the badge's place: an external
                      item never has a pending count to show there, and
                      leaving the panel unannounced is the surprise worth
                      spending a glyph on. The label carries the same fact
                      for a screen reader, which sees no arrow.
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
          </section>
        );
      })}
    </nav>
  );
}
