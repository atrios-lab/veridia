import { formatFullDate } from "@/core/scheduling/calendar.ts";
import { today } from "@/lib/tenant.ts";

export function AdminPageHeader({ title }: { title: string }) {
  return (
    <header className="flex items-center gap-4 border-b border-admin-border bg-admin-card px-[30px] py-4">
      <h1 className="flex-1 font-serif text-xl font-semibold text-admin-primary">
        {title}
      </h1>
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
