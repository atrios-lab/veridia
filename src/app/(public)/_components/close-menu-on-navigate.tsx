"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Closes the <details> this sits in whenever the route changes, and also on a
 * tap on any link inside it: a link to the current route does not change the
 * pathname, so the effect below alone would leave the panel open.
 *
 * The public layout is not re-rendered on a client navigation (the same fact
 * the panel's sidebar-nav.tsx works around), so the native disclosure keeps
 * the `open` it had when the link was tapped and the menu panel stays on top
 * of the page it just opened.
 */
export function CloseMenuOnNavigate() {
  const pathname = usePathname();
  const anchor = useRef<HTMLSpanElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the path is the trigger, not a value the effect reads.
  useEffect(() => {
    anchor.current?.closest("details")?.removeAttribute("open");
  }, [pathname]);

  useEffect(() => {
    const details = anchor.current?.closest("details");
    if (!details) return;
    const onClick = (event: MouseEvent) => {
      if ((event.target as Element).closest("a")) {
        details.removeAttribute("open");
      }
    };
    details.addEventListener("click", onClick);
    return () => details.removeEventListener("click", onClick);
  }, []);

  return <span ref={anchor} hidden />;
}
