"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * The button that opens one of the header's submenus.
 *
 * On the client for the same reason nav-links.tsx is: it marks itself when
 * the page the visitor is on is one of the pages it holds, and that has to
 * follow a client navigation rather than freeze on the first load. Without
 * it, a visitor on "Solicitar serviço" sees nothing marked in the bar, since
 * the link itself is folded away inside the closed panel.
 *
 * `aria-current="true"`, never "page": the page is the link inside, which
 * nav-links.tsx marks, and that one stays the only `page` on the screen.
 *
 * The anchor name is what the panel hangs from (see .header-menu in
 * globals.css). Named after the panel's id, explicitly: a popover's invoker
 * is meant to be its implicit anchor, but not every browser that has
 * anchor positioning resolves that, and one that does not drops the panel
 * in the top left corner of the screen.
 */
export function NavGroupButton({
  hrefs,
  popoverTarget,
  className,
  currentClassName,
  children,
}: {
  /** The pages inside the submenu this button opens. */
  hrefs: readonly string[];
  popoverTarget: string;
  className: string;
  /** Added on top of `className` while the open page is one of `hrefs`. */
  currentClassName: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const current = hrefs.includes(pathname);

  return (
    <button
      type="button"
      popoverTarget={popoverTarget}
      style={{ anchorName: `--${popoverTarget}` }}
      aria-current={current ? "true" : undefined}
      className={current ? `${className} ${currentClassName}` : className}
    >
      {children}
    </button>
  );
}
