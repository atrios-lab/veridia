import Link from "next/link";
import type { RankedTodayAppointment } from "@/core/overview/desk.ts";

const STATE_LABEL: Record<RankedTodayAppointment["state"], string> = {
  done: "concluído",
  next: "próximo · agora",
  "awaiting-confirmation": "aguardando sua confirmação",
  upcoming: "",
};

export function TodayAgenda({
  appointments,
}: {
  appointments: RankedTodayAppointment[];
}) {
  return (
    <div className="rounded-[14px] border border-admin-border bg-admin-card p-5.5">
      <div className="flex items-baseline gap-2.5">
        <h4 className="flex-1 font-serif text-[16.5px] font-semibold text-admin-primary">
          Agenda de hoje
        </h4>
        <Link
          href="/admin/agenda"
          className="text-[12px] font-semibold text-admin-primary"
        >
          abrir agenda
        </Link>
      </div>
      {appointments.length === 0 ? (
        <p className="mt-3.5 text-[13px] text-admin-muted">
          Nenhum compromisso hoje.
        </p>
      ) : (
        <div className="mt-3 flex flex-col">
          {appointments.map((appointment) => (
            <div
              key={appointment.protocolNumber}
              className={`flex items-center gap-3 py-2.5 ${
                appointment.state === "next"
                  ? "-mx-2.5 rounded-[8px] bg-admin-surface px-2.5"
                  : "border-b border-admin-border last:border-b-0"
              }`}
            >
              <span
                className={`w-[42px] flex-none text-[12.5px] font-bold ${
                  appointment.state === "next"
                    ? "text-admin-primary-soft"
                    : "text-admin-faint"
                }`}
              >
                {appointment.slotHour}h
              </span>
              <span
                className={`flex-1 truncate text-[13px] ${
                  appointment.state === "next"
                    ? "font-semibold text-admin-primary"
                    : "text-admin-muted"
                }`}
              >
                {appointment.applicantName ?? "Não informado"} ·{" "}
                {appointment.subject?.trim() || "Atendimento"}
              </span>
              {appointment.state !== "upcoming" && (
                <span
                  className={`flex-none text-[11px] font-semibold ${
                    appointment.state === "next"
                      ? "text-admin-primary-soft"
                      : appointment.state === "awaiting-confirmation"
                        ? "text-admin-warning-text"
                        : "text-admin-faint"
                  }`}
                >
                  {STATE_LABEL[appointment.state]}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
