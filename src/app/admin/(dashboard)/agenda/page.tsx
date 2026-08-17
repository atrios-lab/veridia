import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { closedDate, hasGrid } from "@/core/scheduling/agenda.ts";
import {
  addDays,
  formatFullDate,
  formatShortDate,
} from "@/core/scheduling/calendar.ts";
import { appointmentsOn, getAgendaConfig } from "@/lib/appointments.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import { DayAgenda } from "./_components/day-agenda.tsx";

export const metadata = { title: "Agenda de atendimentos" };

/**
 * The day, not a queue of requests. The office works a date at a time (who
 * is coming, at what hour, for what), so the date is the page's axis and it
 * lives in the query string, where a bookmark and the back button work.
 */
export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string }>;
}) {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "channels.manage")) notFound();
  const tenant = await getTenant();

  const { dia } = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dia ?? "")
    ? (dia as string)
    : today();

  const [config, appointments] = await Promise.all([
    getAgendaConfig(tenant.slug),
    appointmentsOn(tenant.slug, date),
  ]);

  return (
    <>
      <AdminPageHeader title="Agenda de atendimentos" />
      <main className="flex flex-col gap-4.5 px-[30px] py-7">
        {!hasGrid(config) && (
          <div className="rounded-[14px] border border-admin-warning-border bg-admin-warning-bg px-5 py-4">
            <div className="text-[13px] font-bold text-admin-warning-text">
              A agenda ainda não tem horários
            </div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-admin-warning-text">
              Enquanto nenhum dia da semana tiver horário, o site pede que o
              cidadão ligue para a serventia.{" "}
              <Link
                href="/admin/agenda/configuracao"
                className="font-bold underline"
              >
                Definir os horários
              </Link>
            </p>
          </div>
        )}

        <nav className="flex items-center justify-between gap-3">
          <Link
            href={`/admin/agenda?dia=${addDays(date, -1)}`}
            className="rounded-lg border border-admin-border px-3 py-2 text-[12.5px] font-semibold text-admin-muted hover:bg-admin-input-bg"
          >
            ‹ {formatShortDate(addDays(date, -1))}
          </Link>
          <div className="text-center">
            <div className="text-[14.5px] font-bold text-admin-primary">
              {formatFullDate(date)}
            </div>
            {date !== today() && (
              <Link
                href="/admin/agenda"
                className="text-[11.5px] font-semibold text-admin-accent underline"
              >
                Voltar para hoje
              </Link>
            )}
          </div>
          <Link
            href={`/admin/agenda?dia=${addDays(date, 1)}`}
            className="rounded-lg border border-admin-border px-3 py-2 text-[12.5px] font-semibold text-admin-muted hover:bg-admin-input-bg"
          >
            {formatShortDate(addDays(date, 1))} ›
          </Link>
        </nav>

        <DayAgenda
          date={date}
          appointments={appointments.map((appointment) => ({
            id: appointment.id,
            slotTime: appointment.slotTime,
            citizenName: appointment.citizenName,
            email: appointment.email,
            phone: appointment.phone,
            cpf: appointment.cpf,
            serviceLabel: appointment.serviceLabel,
            mode: appointment.mode,
            status: appointment.status,
            cancelReason: appointment.cancelReason,
          }))}
          closedReason={closedDate(config, date)?.reason}
        />
      </main>
    </>
  );
}
