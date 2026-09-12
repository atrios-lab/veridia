"use client";

import { useEffect, useId, useRef, useState } from "react";
import { signOut } from "../actions.ts";
import { AdminIcon } from "./icon.tsx";
import { SignOutButton } from "./sign-out-button.tsx";

/**
 * The person signed in, at the right end of the top bar: avatar, name and a
 * chevron. Clicking opens the role and "Sair". It replaces the sidebar's old
 * footer, and the sign out stays a `<form action={signOut}>` the way it was
 * there: the server ends the session, the button only asks.
 *
 * "Trocar senha" is still not offered here, for the reason the sidebar gave:
 * there is no screen inside the panel for it yet, and a menu item that
 * bounces is worse than one that is missing.
 */
export function UserMenu({
  name,
  initials,
  roleLabel,
}: {
  name: string;
  initials: string;
  roleLabel: string;
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
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative flex-none">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Menu de ${name}`}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex cursor-pointer items-center gap-[9px] rounded-full py-[3px] pr-1.5 pl-[3px] transition-colors duration-120 hover:bg-admin-input-bg"
      >
        <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-admin-success-bg text-[12px] font-bold tracking-[0.02em] text-admin-primary">
          {initials}
        </span>
        <span className="hidden text-[13px] font-semibold whitespace-nowrap text-admin-text sm:inline">
          {name}
        </span>
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
          className="absolute top-[calc(100%+6px)] right-0 z-30 flex min-w-[200px] flex-col gap-0.5 rounded-[11px] border border-admin-border bg-admin-card p-1.5 shadow-[0_8px_24px_rgba(9,24,16,0.12)]"
        >
          <div className="px-2.5 pt-2 pb-2.5">
            <p className="truncate text-[13px] font-semibold text-admin-text">
              {name}
            </p>
            <p className="text-[11.5px] text-admin-muted">{roleLabel}</p>
          </div>
          <hr className="my-0.5 border-0 border-t border-admin-border" />
          <form action={signOut} role="none">
            <SignOutButton className="flex w-full cursor-pointer items-center rounded-[7px] px-2.5 py-2 text-left text-[13px] font-medium text-admin-text transition-colors duration-120 hover:bg-admin-input-bg disabled:cursor-default disabled:opacity-60" />
          </form>
        </div>
      )}
    </div>
  );
}
