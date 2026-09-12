import Link from "next/link";
import type { ReactNode } from "react";

/**
 * A screen's title, in the screen's own content: the heading, an optional
 * line under it and, to the right, whatever the screen's primary action is.
 *
 * It used to be the bar across the top of the panel, with the date and the
 * chat pill; those moved to the top bar the layout renders once for every
 * screen (see top-bar.tsx), and what was left, the title, belongs to the
 * page. Same name and same two props as before, so the screens that call
 * `<AdminPageHeader title="…" />` before their `<main>` went on working
 * without an edit; `description` and `actions` are the two things the queue
 * needed on top.
 */
export function AdminPageHeader({
  title,
  back,
  description,
  actions,
}: {
  title: string;
  /** A subordinate screen's way home, rendered as "‹ Label" over the title. */
  back?: { href: string; label: string };
  /** One sentence under the title, for a screen that needs introducing. */
  description?: string;
  /** The screen's primary action, e.g. the queue's "Lançar pedido". */
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-none flex-wrap items-center gap-5 px-[30px] pt-[30px]">
      <div className="flex min-w-[280px] flex-1 flex-col gap-[5px]">
        {back && (
          <Link
            href={back.href}
            className="self-start text-[13.5px] font-semibold text-admin-muted hover:text-admin-primary"
          >
            ‹ {back.label}
          </Link>
        )}
        <h1 className="font-serif text-[26px] leading-[1.1] font-semibold text-admin-primary">
          {title}
        </h1>
        {description && (
          <p className="max-w-[560px] text-[13.5px] leading-normal text-admin-muted">
            {description}
          </p>
        )}
      </div>
      {actions}
    </div>
  );
}
