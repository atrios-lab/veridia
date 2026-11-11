"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ATTENTION_CLASS } from "./attention.ts";
import { AdminIcon } from "./icon.tsx";
import { type AdminNavItem, navGroups } from "./nav.ts";

const STORAGE_KEY = "veridia.sidebar.groups";

/** What the person opened or closed, remembered in this browser. */
function readSaved(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

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
  // Groups fold (decision of 11/11/2026): the menu grows with every
  // delivery, and a list that scrolls is a list nobody reads. Open by
  // default: the first group and the one holding the current screen; the
  // person's own choices win once made.
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  useEffect(() => setSaved(readSaved()), []);
  const isOpen = (group: string, index: number, hasCurrent: boolean) =>
    hasCurrent || (saved[group] ?? index === 0);
  const toggle = (group: string, open: boolean) => {
    const next = { ...saved, [group]: !open };
    setSaved(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private window: folding still works, it is just not remembered.
    }
  };

  return (
    <nav className="relative flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
      {groups.map(({ group, items: groupItems }, index) => {
        const hasCurrent = groupItems.some((item) => item.href === pathname);
        const open = isOpen(group, index, hasCurrent);
        const waiting = groupItems.reduce(
          (sum, item) => sum + (counts[item.href] ?? 0),
          0,
        );
        const listId = `nav-${index}`;
        return (
          <div key={group} className="flex flex-col">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={listId}
              disabled={hasCurrent}
              onClick={() => toggle(group, open)}
              className="group flex items-center gap-2 rounded-md px-2.5 pt-2.5 pb-1.5 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-admin-on-dark-accent hover:text-white disabled:cursor-default disabled:hover:text-admin-on-dark-accent"
            >
              <span className="flex-1">{group}</span>
              {!open && waiting > 0 && (
                <span className="inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-admin-on-dark-accent px-1.5 text-[10px] font-bold tracking-normal text-admin-primary">
                  {waiting}
                </span>
              )}
              {!hasCurrent && (
                <AdminIcon
                  name="chevronDown"
                  className={`h-3.5 w-3.5 flex-none opacity-70 transition-transform ${open ? "" : "-rotate-90"}`}
                />
              )}
            </button>
            <div id={listId} hidden={!open} className="flex flex-col gap-px">
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
          </div>
        );
      })}
    </nav>
  );
}
