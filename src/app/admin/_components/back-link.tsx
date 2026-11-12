import { ArrowLeft } from "lucide-react";
import Link from "next/link";

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
      className={`inline-flex min-h-11 max-w-full items-center gap-2 self-start rounded-md border bg-background px-3 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-muted md:min-h-8 ${className}`}
    >
      <ArrowLeft aria-hidden className="size-4 flex-none" />
      <span className="truncate">Voltar: {label}</span>
    </Link>
  );
}
