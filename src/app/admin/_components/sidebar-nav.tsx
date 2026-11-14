"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "../_ui/sidebar.tsx";
import { ATTENTION_CLASS } from "./attention.ts";
import { AdminIcon } from "./icon.tsx";
import { type AdminNavItem, navGroups } from "./nav.ts";

/** The groups that fold, and where the person's choice is kept. */
const FOLDABLE = new Set(["Atribuições", "Utilitários"]);
const FOLD_KEY = "admin-nav-folded";

/** The item's screen or one under it (a guide's page, a certidão). */
const isHere = (pathname: string, href: string) =>
  href.startsWith("/admin/") &&
  (pathname === href || pathname.startsWith(`${href}/`));

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
 * Which items exist is still decided on the server (see sidebar.tsx): what
 * arrives here is already filtered by permission.
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
  // On a phone the sidebar is a drawer over the screen: it closes as soon
  // as an item is tapped, and on any change of page (decision of
  // 12/11/2026), so the person lands on the screen they chose instead of
  // having to tap outside the drawer.
  const { isMobile, setOpenMobile } = useSidebar();
  // Only when the path really changes: on a phone this list mounts when
  // the drawer opens, and closing on mount would shut it at once.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);

  // Every group open (decision of 11/11/2026), except Atribuições and
  // Utilitários, which fold (decision of 14/11/2026: "fique igual
  // utilitários, minimizado"): they open by themselves on one of their
  // screens, and the person's choice is remembered on this computer.
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FOLD_KEY) ?? "{}");
      if (saved && typeof saved === "object") setFolded(saved);
    } catch {
      // No storage (private window): every foldable group starts folded.
    }
  }, []);
  const toggle = (group: string, open: boolean) => {
    setFolded((current) => {
      const next = { ...current, [group]: !open };
      try {
        localStorage.setItem(FOLD_KEY, JSON.stringify(next));
      } catch {
        // Not remembered; it still folds now.
      }
      return next;
    });
  };

  return (
    <SidebarContent>
      {navGroups(items).map(({ group, items: groupItems }) => {
        const foldable = FOLDABLE.has(group);
        const here = groupItems.some((item) => isHere(pathname, item.href));
        const open =
          !foldable || here || (group in folded ? !folded[group] : false);
        const listId = `nav-${group.normalize("NFD").replace(/[^a-z]/gi, "")}`;
        return (
          <SidebarGroup key={group}>
            {foldable ? (
              <SidebarGroupLabel
                render={
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={listId}
                    onClick={() => toggle(group, !open)}
                    className="w-full cursor-pointer justify-between hover:text-sidebar-foreground"
                  />
                }
              >
                <span>{group}</span>
                <span className="inline-flex items-center gap-1">
                  {!open && (
                    <span className="tabular-nums">{groupItems.length}</span>
                  )}
                  <AdminIcon
                    name="chevronDown"
                    className={`h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"}`}
                  />
                </span>
              </SidebarGroupLabel>
            ) : (
              <SidebarGroupLabel>{group}</SidebarGroupLabel>
            )}
            {open && (
              <SidebarMenu id={listId}>
                {groupItems.map((item) => {
                  const current = pathname === item.href;
                  const count = counts[item.href];
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={current}
                        tooltip={item.label}
                        // An `attention` item calls until the person answers
                        // it: on its own screen it is just the current item.
                        className={[
                          count ? "pr-9" : "",
                          !current && item.attention ? ATTENTION_CLASS : "",
                        ].join(" ")}
                        render={
                          <Link
                            href={item.href}
                            aria-current={current ? "page" : undefined}
                            // A named tab, not `_blank`: the mailbox is opened
                            // many times a day, and a fresh tab per click buries
                            // the panel by lunchtime.
                            target={item.external ? "zoho" : undefined}
                            rel={item.external ? "noreferrer" : undefined}
                            onClick={() => {
                              if (isMobile) setOpenMobile(false);
                            }}
                          />
                        }
                      >
                        <AdminIcon name={item.icon} />
                        <span className="min-w-0 flex-1">{item.label}</span>
                        {/*
                      The exit arrow: an external item never has a pending
                      count, and leaving the panel unannounced is the surprise
                      worth spending a glyph on. The label carries the same
                      fact for a screen reader, which sees no arrow.
                    */}
                        {item.external && (
                          <>
                            <ExternalLink aria-hidden className="size-3.5!" />
                            <span className="sr-only">
                              (abre fora do painel)
                            </span>
                          </>
                        )}
                      </SidebarMenuButton>
                      {Boolean(count) && (
                        <SidebarMenuBadge>{count}</SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            )}
          </SidebarGroup>
        );
      })}
    </SidebarContent>
  );
}
