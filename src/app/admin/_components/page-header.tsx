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
export async function AdminPageHeader({ title }: { title: string }) {
  const tenant = await getTenant();
  const chatEnabled = await isChatEnabled(tenant.slug);

  return (
    <header className="flex items-center gap-4 border-b border-admin-border bg-admin-card px-[30px] py-4">
      <h1 className="flex-1 font-serif text-xl font-semibold text-admin-primary">
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
