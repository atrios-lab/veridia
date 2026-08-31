"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Closes the menu popover this sits in whenever the route changes, and also
 * on a tap on any link inside it: a link to the current route does not change
 * the pathname, so the effect below alone would leave the panel open. Escape
 * and taps outside are the browser's own job (popover="auto").
 *
 * Neither layout is re-rendered on a client navigation (the same fact the
 * panel's sidebar-nav.tsx works around), so without this the menu would keep
 * showing on top of the page a tapped link just opened. Shared by the public
 * site's menu and the panel's mobile sidebar: same popover, same problem.
 */
export function CloseMenuOnNavigate() {
  const pathname = usePathname();
  const anchor = useRef<HTMLSpanElement>(null);

  const close = () => {
    const popover = anchor.current?.closest<HTMLElement>("[popover]");
    if (popover?.matches(":popover-open")) popover.hidePopover();
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: the path is the trigger, not a value the effect reads.
  useEffect(close, [pathname]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: close reads only refs, it never goes stale.
  useEffect(() => {
    const popover = anchor.current?.closest("[popover]");
    if (!popover) return;
    const onClick = (event: Event) => {
      if ((event.target as Element).closest("a")) close();
    };
    popover.addEventListener("click", onClick);
    return () => popover.removeEventListener("click", onClick);
  }, []);

  return <span ref={anchor} hidden />;
}
