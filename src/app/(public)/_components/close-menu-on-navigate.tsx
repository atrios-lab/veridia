"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Closes the <details> this sits in whenever the route changes.
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

  return <span ref={anchor} hidden />;
}
