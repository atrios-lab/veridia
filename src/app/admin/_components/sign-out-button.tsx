"use client";

import { useFormStatus } from "react-dom";

/**
 * The "Sair" button in the user menu, as its own client boundary: only this
 * button needs `useFormStatus` to disable itself and name the wait for the
 * second or two the sign-out server action takes before it redirects to the
 * login screen.
 */
export function SignOutButton({
  className = "btn btn-admin-ghost btn-sm px-0",
}: {
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Saindo…" : "Sair"}
    </button>
  );
}
