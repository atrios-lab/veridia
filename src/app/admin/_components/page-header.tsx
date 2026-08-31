import Link from "next/link";
import { formatFullDate } from "@/core/scheduling/calendar.ts";
import { isChatEnabled } from "@/lib/chat.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { AdminIcon } from "./icon.tsx";

/**
 * The date and the "Disponível para o chat" indicator appear on every panel
 * screen, so this fetches its own data rather than taking it as a prop:
 * same reasoning as `today()` below, and it is what keeps every existing
 * `<AdminPageHeader title="..." />` call site from having to learn about
 * chat. Replaces the purely visual element registered as a Non-Goal in
 * add-admin-service-requests (see admin-shell spec, "Indicador 'Disponível
 * para o chat'... reflete estado real").
 */
/**
 * The drawer the button below opens. Shared with the dashboard layout, which
 * renders the drawer itself: `popovertarget` pairs them by id, so the two do
 * not have to sit next to each other in the tree.
 */
export const ADMIN_MENU_ID = "admin-menu";

export async function AdminPageHeader({
  title,
  back,
}: {
  title: string;
  /** A subordinate screen's way home, rendered as "‹ Label" before the title. */
  back?: { href: string; label: string };
}) {
  const tenant = await getTenant();
  const chatEnabled = await isChatEnabled(tenant.slug);

  return (
    <header className="flex items-center gap-4 border-b border-admin-border bg-admin-card px-[30px] py-4">
      {/* The only way to the navigation on a phone, where the sidebar is a
          drawer instead of a column. */}
      <button
        type="button"
        popoverTarget={ADMIN_MENU_ID}
        className="-ml-1.5 flex cursor-pointer items-center rounded-lg p-1.5 text-admin-primary md:hidden"
      >
        <AdminIcon name="menu" className="h-5.5 w-5.5" />
        <span className="sr-only">Abrir menu do painel</span>
      </button>
      <h1 className="flex flex-1 items-baseline gap-3 font-serif text-xl font-semibold text-admin-primary">
        {back && (
          <Link
            href={back.href}
            className="font-sans text-[13.5px] font-semibold text-admin-muted hover:text-admin-primary"
          >
            ‹ {back.label}
          </Link>
        )}
        {title}
      </h1>
      <span
        className={`inline-flex items-center gap-2 rounded-full py-1.5 pr-3 pl-3 text-[12px] font-semibold ${
          chatEnabled
            ? "bg-admin-success-bg text-admin-success-text"
            : "bg-admin-readonly-bg text-admin-muted"
        }`}
      >
        <AdminIcon name="chat" className="h-3.5 w-3.5" />
        {chatEnabled ? "Disponível para o chat" : "Indisponível para o chat"}
      </span>
      {/*
        `today()` is the office's wall calendar, not the server's. Vercel runs
        in UTC, so from nine at night a plain new Date() stamps this header
        with tomorrow, on the panel of an office that is closed.
      */}
      <span className="text-[12.5px] text-admin-muted">
        {formatFullDate(today())}
      </span>
    </header>
  );
}
