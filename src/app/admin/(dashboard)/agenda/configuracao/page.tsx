import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  AGENDA_IDS,
  AGENDA_WEEKDAYS,
  type AgendaId,
  timesForWeekday,
  WEEKDAY_LABELS,
} from "@/core/scheduling/agenda.ts";
import { addDays, officeHolidays } from "@/core/scheduling/calendar.ts";
import {
  futureLiveByWeekdayTime,
  getAgendaConfig,
  takenTimesByDay,
} from "@/lib/appointments.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { AgendaSettingsForm } from "./agenda-settings-form.tsx";

export const metadata = { title: "Configuração das agendas" };

/** How far ahead the live preview can strike taken times through: four weeks
 * covers the three example dates it shows for any weekday. */
const PREVIEW_WINDOW_DAYS = 27;

export default async function AgendaSettingsPage() {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "channels.manage")) notFound();
  const tenant = await getTenant();

  const from = today();
  const [config, taken, futureGeral, futureTabeliao] = await Promise.all([
    getAgendaConfig(tenant.slug),
    takenTimesByDay(tenant.slug, from, addDays(from, PREVIEW_WINDOW_DAYS)),
    futureLiveByWeekdayTime(tenant.slug, from, "geral"),
    futureLiveByWeekdayTime(tenant.slug, from, "tabeliao"),
  ]);

  const agendas = Object.fromEntries(
    AGENDA_IDS.map((id) => [
      id,
      {
        grid: Object.fromEntries(
          AGENDA_WEEKDAYS.map((day) => [
            String(day),
            timesForWeekday(config.agendas[id], day),
          ]),
        ),
        serviceIds: config.agendas[id].serviceIds,
      },
    ]),
  ) as Record<
    AgendaId,
    { grid: Record<string, string[]>; serviceIds: string[] }
  >;

  return (
    <>
      <AdminPageHeader
        title="Configuração das agendas"
        back={{ href: "/admin/agenda", label: "Agenda" }}
      />
      <main className="px-[30px] py-7">
        <AgendaSettingsForm
          initial={{
            agendas,
            services: config.services.map(({ id, label, bring }) => ({
              id,
              label,
              bring,
            })),
            modes: config.modes,
          }}
          weekdays={AGENDA_WEEKDAYS.map((day) => ({
            day: String(day),
            label: WEEKDAY_LABELS[day],
          }))}
          closedDates={config.closedDates.map((closed) => closed.date)}
          holidays={officeHolidays(tenant)}
          takenByDate={Object.fromEntries(
            [...taken.entries()].map(([date, times]) => [date, [...times]]),
          )}
          futureLive={{ geral: futureGeral, tabeliao: futureTabeliao }}
          today={from}
        />
      </main>
    </>
  );
}
