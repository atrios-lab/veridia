"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "../_ui/button.tsx";
import { cn } from "../_ui/cn.ts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "../_ui/dropdown-menu.tsx";

export interface DropdownOption {
  value: string;
  label: string;
  /** Where choosing it goes: every option is a navigation, not a form value. */
  href: string;
}

/**
 * A menu of links dressed as a select: the trigger shows the current choice,
 * the menu lists the alternatives with a tick on the active one.
 *
 * Links rather than a `<select>` because choosing here changes the URL (the
 * queue's tab, filter and page size all live there), and a link already does
 * that with no client router in the way: middle-click opens the choice in a
 * new tab, the back button undoes it. Each option is a radio item of the
 * panel's `DropdownMenu` drawn as that link, so it keeps `menuitemradio`, the
 * role that says "one of these is on" without pretending to be a form
 * control, and the menu brings open/close, Escape, click outside and the
 * arrow keys like every other menu in the panel.
 */
export function Dropdown({
  label,
  options,
  value,
  triggerClassName: _triggerClassName,
  menuClassName = "min-w-50",
}: {
  /** The trigger's text: the current choice, e.g. "Atribuição: todas". */
  label: string;
  options: readonly DropdownOption[];
  value: string;
  /**
   * The trigger's padding, from when the two uses differed by a pixel.
   * Ignored since the trigger became an `outline` button of the panel's
   * scale; kept so the callers compile unchanged.
   */
  triggerClassName?: string;
  /** The menu's width. */
  menuClassName?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: "outline" }),
          "data-popup-open:bg-muted",
        )}
      >
        {label}
        <ChevronDown aria-hidden className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className={cn("w-auto", menuClassName)}>
        <DropdownMenuRadioGroup value={value}>
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              closeOnClick
              render={<Link href={option.href} scroll={false} />}
              className="whitespace-nowrap data-checked:font-medium"
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
