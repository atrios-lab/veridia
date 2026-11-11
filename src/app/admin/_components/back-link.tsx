import Link from "next/link";
import { AdminIcon } from "./icon";

/**
 * The way back from a subordinate screen (decision of 11/11/2026): a real
 * button with an arrow, not a faint "‹ Label" line, so it is found at a
 * glance on a computer and is easy to tap on a phone (44px tall there).
 */
export function BackLink({
  href,
  label,
  className = "",
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 max-w-full items-center gap-2 self-start rounded-full border border-admin-border bg-admin-card py-1.5 pr-4 pl-2 text-[14px] font-semibold text-admin-primary shadow-sm transition-colors hover:border-admin-primary hover:bg-admin-primary hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-primary md:min-h-9 ${className}`}
    >
      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-admin-primary/10">
        <AdminIcon name="arrowLeft" className="h-4 w-4" strokeWidth={2.2} />
      </span>
      <span className="truncate">Voltar: {label}</span>
    </Link>
  );
}
