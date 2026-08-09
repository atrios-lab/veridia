"use client";

import { useFormStatus } from "react-dom";

/**
 * The "Sair" button in the sidebar footer, as its own client boundary: the
 * rest of AdminSidebar stays a server component, and only this button needs
 * `useFormStatus` to disable itself and name the wait for the second or two
 * the sign-out server action takes before it redirects to the login screen.
 */
export function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="underline hover:text-white disabled:opacity-70"
    >
      {pending ? "Saindo…" : "Sair"}
    </button>
  );
}
