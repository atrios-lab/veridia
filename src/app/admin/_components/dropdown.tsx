"use client";

import Link from "next/link";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { AdminIcon } from "./icon.tsx";

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
 * new tab, the back button undoes it. `menuitemradio` is the role that says
 * "one of these is on" without pretending to be a form control.
 *
 * Small on purpose: open/close, Escape, click outside, arrow keys between
 * options. Nothing here needs a library.
 */
export function Dropdown({
  label,
  options,
  value,
  triggerClassName = "py-2 pr-2.5 pl-3",
  menuClassName = "min-w-[200px]",
}: {
  /** The trigger's text: the current choice, e.g. "Atribuição: todas". */
  label: string;
  options: readonly DropdownOption[];
  value: string;
  /** The trigger's padding: the two uses differ by a pixel, per the design. */
  triggerClassName?: string;
  /** The menu's width. */
  menuClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function items(): HTMLElement[] {
    return Array.from(
      root.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ??
        [],
    );
  }

  function focusItem(index: number) {
    const list = items();
    if (list.length === 0) return;
    list[(index + list.length) % list.length]?.focus();
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      // The menu is not in the DOM until the next render.
      requestAnimationFrame(() =>
        focusItem(event.key === "ArrowDown" ? 0 : -1),
      );
    }
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const list = items();
    const current = list.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(current + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(current - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusItem(-1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={root} className="relative inline-flex">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        className={`inline-flex cursor-pointer items-center gap-2.5 rounded-[9px] border bg-admin-card text-[13px] font-semibold whitespace-nowrap text-admin-primary transition-colors duration-120 ${
          open
            ? "border-admin-primary-soft"
            : "border-admin-input-border hover:border-admin-faint"
        } ${triggerClassName}`}
      >
        {label}
        <AdminIcon
          name="chevronDown"
          className="h-4 w-4 flex-none text-admin-muted"
          strokeWidth={2}
        />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          onKeyDown={onMenuKeyDown}
          className={`absolute top-[calc(100%+6px)] left-0 z-20 flex flex-col gap-0.5 rounded-[11px] border border-admin-border bg-admin-card p-1.5 shadow-[0_8px_24px_rgba(9,24,16,0.12)] ${menuClassName}`}
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <Link
                key={option.value}
                role="menuitemradio"
                aria-checked={active}
                href={option.href}
                scroll={false}
                tabIndex={-1}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 rounded-[7px] px-2.5 py-2 text-[13px] whitespace-nowrap transition-colors duration-120 hover:bg-admin-input-bg focus-visible:bg-admin-input-bg focus-visible:outline-none ${
                  active
                    ? "bg-admin-success-bg font-bold text-admin-primary"
                    : "font-medium text-admin-text"
                }`}
              >
                <span className="flex-1">{option.label}</span>
                <AdminIcon
                  name="check"
                  strokeWidth={2.6}
                  className={`h-3.5 w-3.5 flex-none text-admin-primary-soft ${
                    active ? "" : "opacity-0"
                  }`}
                />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
