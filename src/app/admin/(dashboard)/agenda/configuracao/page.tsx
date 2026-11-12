import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  AGENDA_IDS,
  AGENDA_WEEKDAYS,
  type AgendaId,
  type AttendanceChannel,
  timesForWeekday,
  WEEKDAY_LABELS,
} from "@/core/scheduling/agenda.ts";
import { addDays, officeHolidays } from "@/core/scheduling/calendar.ts";
import {
  COUNTER_SERVICES,
  resolveService,
} from "@/core/scheduling/services.ts";
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
  if (
    !session ||
    !can(session.user.role ?? "", "channels.manage", session.user.permissions)
  )
    notFound();
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
        slotServices: config.agendas[id].slotServices,
        slotCapacity: config.agendas[id].slotCapacity,
        serviceIds: config.agendas[id].serviceIds,
        channels: config.agendas[id].channels,
      },
    ]),
  ) as Record<
    AgendaId,
    {
      grid: Record<string, string[]>;
      slotServices: Record<string, Record<string, string[]>>;
      slotCapacity: Record<string, Record<string, number>>;
      serviceIds: string[];
      channels: Record<string, AttendanceChannel[]>;
    }
  >;

  // Every service's list as saved, catalogue and own alike, for the
  // picker's "O que levar" and the link to its editor.
  const lists = Object.fromEntries(
    [
      ...COUNTER_SERVICES.map((service) => service.id),
      ...config.services.map((service) => service.id),
    ].flatMap((id) => {
      const service = resolveService(config, id);
      return service
        ? [
            [
              id,
              {
                items: service.checklist,
                edited: Boolean(config.checklists[id]?.items),
                hasFile: service.hasOwnFile,
              },
            ],
          ]
        : [];
    }),
  );

  return (
    <>
      <AdminPageHeader
        title="Configuração das agendas"
        back={{ href: "/admin/agenda", label: "Agenda" }}
      />
      <main className="px-4 pt-6 pb-8 md:px-8">
        <AgendaSettingsForm
          lists={lists}
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
