"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { useFormStatus } from "react-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../_ui/dropdown-menu.tsx";
import { signOut } from "../actions.ts";

/**
 * The person signed in, at the right of the top bar: initials and name, and
 * behind them the account's own actions and "Sair". A menu from _ui, so the
 * keyboard, Escape and the click outside behave like every other menu in
 * the panel.
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
  const signOutForm = useRef<HTMLFormElement>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Menu de ${name}`}
          className="inline-flex flex-none cursor-pointer items-center gap-2 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-muted data-popup-open:bg-muted"
        >
          <span className="inline-flex size-8 flex-none items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initials}
          </span>
          <span className="hidden text-sm font-medium whitespace-nowrap sm:inline">
            {name}
          </span>
          <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <span className="block truncate text-sm font-medium text-foreground">
                {name}
              </span>
              <span className="block text-xs font-normal text-muted-foreground">
                {roleLabel}
              </span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/admin/minha-conta#senha" />}>
            Trocar minha senha
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/admin/minha-conta" />}>
            Verificação em duas etapas
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => signOutForm.current?.requestSubmit()}
          >
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* The sign-out action, outside the menu: the menu closes on click,
          and a form inside a closed popup would unmount mid-submit. */}
      <form ref={signOutForm} action={signOut} className="contents">
        <SigningOut />
      </form>
    </>
  );
}

/** Says the wait out loud for the second the sign-out action takes. */
function SigningOut() {
  const { pending } = useFormStatus();
  return (
    <output className="sr-only">{pending ? "Saindo…" : ""}</output>
  );
}
