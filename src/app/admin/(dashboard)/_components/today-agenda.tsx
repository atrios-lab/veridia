import Link from "next/link";
import type { RankedTodayAppointment } from "@/core/overview/desk.ts";
import { Badge } from "../../_ui/badge.tsx";
import { buttonVariants } from "../../_ui/button.tsx";
import { cn } from "../../_ui/cn.ts";

const STATE_LABEL: Record<RankedTodayAppointment["state"], string> = {
  done: "concluído",
  next: "próximo · agora",
  upcoming: "",
};

export function TodayAgenda({
  appointments,
}: {
  appointments: RankedTodayAppointment[];
}) {
  return (
    <section className="rounded-xl border bg-card shadow-xs">
      <div className="flex items-center gap-2.5 px-6 pt-6 pb-3">
        <h2 className="flex-1 text-lg font-semibold text-foreground">
          Agenda de hoje
        </h2>
        <Link
          href="/admin/agenda"
          className={cn(
            buttonVariants({ variant: "link", size: "sm" }),
            "px-0",
          )}
        >
          abrir agenda
        </Link>
      </div>
      {appointments.length === 0 ? (
        <p className="px-6 pb-6 text-sm text-muted-foreground">
          Nenhum compromisso hoje.
        </p>
      ) : (
        <ul className="divide-y border-t">
          {appointments.map((appointment) => (
            <li
              key={appointment.id}
              className={cn(
                "flex items-center gap-3 px-6 py-2.5",
                appointment.state === "next" && "bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "w-12 flex-none text-sm font-medium tabular-nums",
                  appointment.state === "next"
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {appointment.slotTime}
              </span>
              <span
                className={cn(
                  "flex-1 truncate text-sm",
                  appointment.state === "next"
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {appointment.citizenName} · {appointment.serviceLabel}
              </span>
              {appointment.state !== "upcoming" && (
                <Badge
                  variant={appointment.state === "next" ? "default" : "outline"}
                  className={cn(
                    "flex-none",
                    appointment.state === "done" && "text-muted-foreground",
                  )}
                >
                  {STATE_LABEL[appointment.state]}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
