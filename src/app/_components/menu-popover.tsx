"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** The class globals.css shows a menu with, where the popover API is absent. */
const FALLBACK_OPEN = "popover-fallback-open";

/**
 * Whether this browser implements the popover API. Safari before 17, Chrome
 * before 114 and Firefox before 125 do not, which in practice means every
 * iPhone still on iOS 16.
 *
 * There the attribute is inert and three things break at once: no UA rule
 * hides the menu, so it renders permanently open on top of the page;
 * `popovertarget` on the button does nothing; and `matches(":popover-open")`
 * throws a SyntaxError rather than answering false, because the pseudo-class
 * is not a valid selector there. The office reported a menu that would not
 * close, and this is what that looks like from the inside.
 */
function hasPopoverApi(): boolean {
  return (
    typeof HTMLElement !== "undefined" &&
    Object.hasOwn(HTMLElement.prototype, "popover")
  );
}

/**
 * Makes the menu popover this sits inside behave, on every browser.
 *
 * Two jobs. The first is closing on navigation and on a tap on any link
 * inside: a link to the current route does not change the pathname, so the
 * effect alone would leave the panel open, and neither layout is re-rendered
 * on a client navigation (the same fact the panel's sidebar-nav.tsx works
 * around). The second is standing in for the API where it does not exist,
 * toggling a class the stylesheet understands.
 *
 * Where the API is there, it stays in charge: Escape, the tap outside and the
 * backdrop are the browser's own and this touches none of them.
 */
export function MenuPopover() {
  const pathname = usePathname();
  const anchor = useRef<HTMLSpanElement>(null);

  // One effect, re-run on every navigation: re-attaching a listener costs
  // nothing and the alternative is two effects that have to agree on what
  // "close" means.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the path is the trigger, not a value the effect reads.
  useEffect(() => {
    const menu = anchor.current?.closest<HTMLElement>("[popover]");
    if (!menu) return;
    const native = hasPopoverApi();

    const close = () => {
      if (!native) return menu.classList.remove(FALLBACK_OPEN);
      if (menu.matches(":popover-open")) menu.hidePopover();
    };

    // A navigation already happened by the time this runs: close whatever the
    // tap that caused it left open.
    close();

    const onMenuClick = (event: Event) => {
      if ((event.target as Element).closest("a")) close();
    };
    menu.addEventListener("click", onMenuClick);

    if (native) {
      return () => menu.removeEventListener("click", onMenuClick);
    }

    // Everything below only runs where the API is missing, standing in for
    // the parts of it this menu actually depends on: the button that opens
    // it, and the tap outside that dismisses it.
    const buttons = document.querySelectorAll<HTMLElement>(
      `[popovertarget="${menu.id}"]`,
    );
    const onButtonClick = (event: Event) => {
      event.preventDefault();
      menu.classList.toggle(FALLBACK_OPEN);
    };
    for (const button of buttons) {
      button.addEventListener("click", onButtonClick);
    }

    const onDocumentClick = (event: Event) => {
      const target = event.target as Node;
      if (menu.contains(target)) return;
      for (const button of buttons) if (button.contains(target)) return;
      menu.classList.remove(FALLBACK_OPEN);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") menu.classList.remove(FALLBACK_OPEN);
    };
    document.addEventListener("click", onDocumentClick);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      menu.removeEventListener("click", onMenuClick);
      for (const button of buttons) {
        button.removeEventListener("click", onButtonClick);
      }
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pathname]);

  return <span ref={anchor} hidden />;
}
