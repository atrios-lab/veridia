"use client";

import { ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../_ui/collapsible.tsx";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "../_ui/sidebar.tsx";
import { ATTENTION_CLASS } from "./attention.ts";
import { AdminIcon } from "./icon.tsx";
import {
  type AdminNavItem,
  type AdminNavSubItem,
  currentChild,
  navGroups,
} from "./nav.ts";

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

  // Every group open, always (decision of 11/11/2026): with the groups
  // folded, people could not find the screens. The titles only organize.
  return (
    <SidebarContent>
      {navGroups(items).map(({ group, items: groupItems }) => (
        <SidebarGroup key={group}>
          <SidebarGroupLabel>{group}</SidebarGroupLabel>
          <SidebarMenu>
            {groupItems.map((item) => {
              if (item.children?.length)
                return (
                  <AdminSidebarFold
                    key={item.href}
                    item={item}
                    screens={item.children}
                    pathname={pathname}
                    count={counts[item.href]}
                  />
                );
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
                        <span className="sr-only">(abre fora do painel)</span>
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
        </SidebarGroup>
      ))}
    </SidebarContent>
  );
}

/**
 * An item with screens of its own, as shadcn's sidebar draws it: the item
 * folds and unfolds, and its screens hang from a guide line under it. It
 * opens by itself when the person is on one of its screens, so the current
 * page is never hidden in a closed fold.
 *
 * With the sidebar shrunk to its icons there is no room for the list: the
 * icon then leads straight to the tool's first screen, like any other item.
 */
function AdminSidebarFold({
  item,
  screens,
  pathname,
  count,
}: {
  item: AdminNavItem;
  screens: readonly AdminNavSubItem[];
  pathname: string;
  count?: number;
}) {
  const { isMobile, state, setOpenMobile } = useSidebar();
  const active = currentChild(screens, pathname);
  const [open, setOpen] = useState(Boolean(active));
  // Arriving on one of its screens from elsewhere (a link inside a page,
  // the search) unfolds it; leaving does not fold it back, the person
  // may have opened it on purpose.
  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  const badge = Boolean(count) && (
    <SidebarMenuBadge className={open ? "hidden" : undefined}>
      {count}
    </SidebarMenuBadge>
  );

  if (state === "collapsed" && !isMobile) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={Boolean(active)}
          tooltip={item.label}
          render={
            <Link
              href={item.href}
              aria-current={active === pathname ? "page" : undefined}
            />
          }
        >
          <AdminIcon name={item.icon} />
          <span className="min-w-0 flex-1">{item.label}</span>
        </SidebarMenuButton>
        {badge}
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      render={<SidebarMenuItem />}
    >
      <CollapsibleTrigger
        render={
          <SidebarMenuButton
            tooltip={item.label}
            className={count && !open ? "pr-9" : undefined}
          />
        }
      >
        <AdminIcon name={item.icon} />
        <span className="min-w-0 flex-1">{item.label}</span>
        <ChevronRight
          aria-hidden
          className={[
            "text-sidebar-label transition-transform duration-200",
            open ? "rotate-90" : "",
            count && !open ? "hidden" : "",
          ].join(" ")}
        />
      </CollapsibleTrigger>
      {badge}
      <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
        <SidebarMenuSub className="mt-1">
          {screens.map((child) => {
            const current = active === child.href;
            return (
              <SidebarMenuSubItem key={child.href}>
                <SidebarMenuSubButton
                  isActive={current}
                  className="h-auto min-h-7 py-1"
                  render={
                    <Link
                      href={child.href}
                      aria-current={
                        child.href === pathname ? "page" : undefined
                      }
                      onClick={() => {
                        if (isMobile) setOpenMobile(false);
                      }}
                    />
                  }
                >
                  <span>{child.label}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            );
          })}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
}
