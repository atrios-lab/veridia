import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  AGENDA_WEEKDAYS,
  timesForWeekday,
  WEEKDAY_LABELS,
} from "@/core/scheduling/agenda.ts";
import { addDays } from "@/core/scheduling/calendar.ts";
import {
  futureLiveByWeekdayTime,
  getAgendaConfig,
  takenTimesByDay,
} from "@/lib/appointments.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { AgendaSettingsForm } from "./agenda-settings-form.tsx";

export const metadata = { title: "Configuração da agenda" };

/** How far ahead the live preview can strike taken times through: four weeks
 * covers the three example dates it shows for any weekday. */
const PREVIEW_WINDOW_DAYS = 27;

export default async function AgendaSettingsPage() {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "channels.manage")) notFound();
  const tenant = await getTenant();

  const from = today();
  const [config, taken, futureLive] = await Promise.all([
    getAgendaConfig(tenant.slug),
    takenTimesByDay(tenant.slug, from, addDays(from, PREVIEW_WINDOW_DAYS)),
    futureLiveByWeekdayTime(tenant.slug, from),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Configuração da agenda"
        back={{ href: "/admin/agenda", label: "Agenda" }}
      />
      <main className="px-[30px] py-7">
        <AgendaSettingsForm
          initialGrid={Object.fromEntries(
            AGENDA_WEEKDAYS.map((day) => [
              String(day),
              timesForWeekday(config, day),
            ]),
          )}
          weekdays={AGENDA_WEEKDAYS.map((day) => ({
            day: String(day),
            label: WEEKDAY_LABELS[day],
          }))}
          initialServices={config.services.map((service) => ({
            label: service.label,
            notaryOnly: service.notaryOnly,
          }))}
          initialModes={config.modes}
          closedDates={config.closedDates.map((closed) => closed.date)}
          takenByDate={Object.fromEntries(
            [...taken.entries()].map(([date, times]) => [date, [...times]]),
          )}
          futureLive={futureLive}
          today={from}
        />
      </main>
    </>
  );
}
