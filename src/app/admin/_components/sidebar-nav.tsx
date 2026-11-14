"use client";

import { ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
import { AdminIcon, type AdminIconName } from "./icon.tsx";
import {
  type AdminNavItem,
  type AdminNavNode,
  countIn,
  currentHref,
  FOLDED_GROUPS,
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
  // The tab of a screen with tabs in the menu (the Registro Civil's books).
  const search = useSearchParams().toString();
  const location = search ? `${pathname}?${search}` : pathname;
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
  // The one exception is a group drawn as a topic of its own (see
  // FOLDED_GROUPS): it has no heading, it is the fold.
  return (
    <SidebarContent>
      {navGroups(items).map(({ group, items: groupItems }) => {
        const foldIcon = FOLDED_GROUPS[group];
        if (foldIcon)
          return (
            <SidebarGroup key={group}>
              <SidebarMenu>
                <NavFold
                  label={group}
                  icon={foldIcon}
                  nodes={groupItems}
                  pathname={location}
                  counts={counts}
                />
              </SidebarMenu>
            </SidebarGroup>
          );
        return (
          <SidebarGroup key={group}>
            <SidebarGroupLabel>{group}</SidebarGroupLabel>
            <SidebarMenu>
              {groupItems.map((item) => {
                if (item.children && item.children.length > 1)
                  return (
                    <NavFold
                      key={item.href}
                      label={item.label}
                      icon={item.icon}
                      nodes={item.children}
                      pathname={location}
                      counts={counts}
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
        );
      })}
    </SidebarContent>
  );
}

/** The unfold animation of shadcn's collapsible menu. */
const FOLD_PANEL =
  "h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0";

/** The labels of the tree wrap instead of cutting: the column is narrow. */
const SUB_BUTTON = "h-auto min-h-7 py-1 text-left";

/**
 * Open when the person is inside; arriving on another of its screens from
 * elsewhere (a link inside a page, the search) unfolds it again. Leaving does
 * not fold it back: the person may have opened it on purpose.
 */
function useUnfold(active: string | undefined) {
  const [open, setOpen] = useState(Boolean(active));
  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);
  return [open, setOpen] as const;
}

function Chevron({ open, hidden }: { open: boolean; hidden?: boolean }) {
  return (
    <ChevronRight
      aria-hidden
      className={[
        "ml-auto text-sidebar-label transition-transform duration-200",
        open ? "rotate-90" : "",
        hidden ? "hidden" : "",
      ].join(" ")}
    />
  );
}

function SubBadge({ count }: { count: number }) {
  return (
    <span className="ml-auto flex h-5 min-w-5 flex-none items-center justify-center rounded-full bg-sidebar-primary px-1.5 text-xs font-medium text-sidebar-primary-foreground tabular-nums">
      {count}
    </span>
  );
}

/**
 * A topic with subtopics, as shadcn's sidebar draws it: it folds and
 * unfolds, and what it holds hangs from a guide line under it, one level
 * per fold ("Utilitários" > "Livro Diário Auxiliar" > "Lançamento"). A
 * closed fold carries the sum of the counts inside it, so a pending guia
 * is never hidden by a fold.
 *
 * With the sidebar shrunk to its icons there is no room for the tree: the
 * icon opens the sidebar with the fold unfolded.
 */
function NavFold({
  label,
  icon,
  nodes,
  pathname,
  counts,
}: {
  label: string;
  icon: AdminIconName;
  nodes: readonly AdminNavNode[];
  pathname: string;
  counts: Record<string, number>;
}) {
  const { isMobile, state, setOpen: setSidebarOpen } = useSidebar();
  const active = currentHref(nodes, pathname);
  const [open, setOpen] = useUnfold(active);
  const iconOnly = state === "collapsed" && !isMobile;
  const total = nodes.reduce((sum, node) => sum + countIn(node, counts), 0);
  const showTotal = total > 0 && (!open || iconOnly);

  return (
    <Collapsible
      open={open && !iconOnly}
      onOpenChange={(next) => {
        if (iconOnly) {
          setSidebarOpen(true);
          setOpen(true);
        } else setOpen(next);
      }}
      render={<SidebarMenuItem />}
    >
      <CollapsibleTrigger
        render={
          <SidebarMenuButton
            tooltip={label}
            isActive={iconOnly && Boolean(active)}
            className={showTotal ? "pr-9" : undefined}
          />
        }
      >
        <AdminIcon name={icon} />
        <span className="min-w-0 flex-1">{label}</span>
        <Chevron open={open} hidden={showTotal} />
      </CollapsibleTrigger>
      {showTotal && <SidebarMenuBadge>{total}</SidebarMenuBadge>}
      <CollapsibleContent className={FOLD_PANEL}>
        <SidebarMenuSub className="mt-1">
          {nodes.map((node) => (
            <NavBranch
              key={node.href}
              node={node}
              active={active}
              pathname={pathname}
              counts={counts}
            />
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * One line inside a fold: a screen, or a tool that folds its own screens.
 * A tool left with a single screen (the rest hidden by permission) is just
 * that screen: a fold with one line inside is a click for nothing.
 */
function NavBranch({
  node,
  active,
  pathname,
  counts,
}: {
  node: AdminNavNode;
  active: string | undefined;
  pathname: string;
  counts: Record<string, number>;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const screens = node.children ?? [];
  const inside =
    screens.length > 1 ? currentHref(screens, pathname) : undefined;
  const [open, setOpen] = useUnfold(inside);

  if (screens.length < 2) {
    const count = counts[node.href];
    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          isActive={active === node.href}
          className={SUB_BUTTON}
          render={
            <Link
              href={node.href}
              aria-current={active === node.href ? "page" : undefined}
              onClick={() => {
                if (isMobile) setOpenMobile(false);
              }}
            />
          }
        >
          <span className="min-w-0 flex-1 whitespace-normal!">
            {node.label}
          </span>
          {Boolean(count) && <SubBadge count={count} />}
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    );
  }

  const total = countIn(node, counts);
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      render={<SidebarMenuSubItem />}
    >
      <CollapsibleTrigger
        render={
          <SidebarMenuSubButton
            className={`${SUB_BUTTON} w-full`}
            render={<button type="button" />}
          />
        }
      >
        <span className="min-w-0 flex-1 whitespace-normal!">{node.label}</span>
        {total > 0 && !open ? (
          <SubBadge count={total} />
        ) : (
          <Chevron open={open} />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className={FOLD_PANEL}>
        {/* A third level: a shorter indent, or the screens' names
            would wrap in the narrow column. */}
        <SidebarMenuSub className="mt-1 mr-0 ml-2 pr-0 pl-2">
          {screens.map((screen) => (
            <NavBranch
              key={screen.href}
              node={screen}
              active={active}
              pathname={pathname}
              counts={counts}
            />
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
}
