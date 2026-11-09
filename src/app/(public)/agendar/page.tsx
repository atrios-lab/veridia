import {
  AGENDA_IDS,
  AGENDA_NAMES,
  type AgendaId,
  type AgendaWeekday,
  agendaRules,
  CHANNEL_NAMES,
  channelLabelsOn,
  channelsOn,
  hasGrid,
  isAgendaId,
  usesChannels,
} from "@/core/scheduling/agenda.ts";
import { officeHolidays, weekday } from "@/core/scheduling/calendar.ts";
import {
  offeredAgendas,
  servicesOfAgenda,
} from "@/core/scheduling/services.ts";
import {
  firstFreeSlot,
  freeSlots,
  nextDayWithSlot,
  offeredDays,
} from "@/core/scheduling/slots.ts";
import { getAgendaConfig, takenTimesByDay } from "@/lib/appointments.ts";
import { officeNow } from "@/lib/tenant.ts";
import { publicMetadata } from "../_lib/metadata.ts";
import { requireSection } from "../_lib/section.ts";
import { SchedulingScreen } from "./appointment-form.tsx";

export const generateMetadata = publicMetadata("/agendar");

/**
 * The chosen agenda and day live in the query string, so the times are
 * rendered on the server against the office's real bookings. Back button,
 * bookmark and a shared link all behave the way the citizen expects, and
 * availability is never guessed in the browser.
 */
export default async function SchedulingPage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string; agenda?: string }>;
}) {
  const tenant = await requireSection("agendamento");
  const { dia, agenda: agendaParam } = await searchParams;

  const config = await getAgendaConfig(tenant.slug);
  const holidays = officeHolidays(tenant);
  const now = officeNow();
  const base = {
    openingHours: tenant.openingHours,
    phone: tenant.contacts.phone,
    whatsapp: tenant.contacts.whatsapp,
    email: tenant.contacts.email,
  };

  // Only the agendas with hours, services and a day ahead are offered.
  const agendas = offeredAgendas(config).filter(
    (id) =>
      offeredDays({ ...agendaRules(config, id), holidays }, now.date).length >
      0,
  );
  const choices = agendas.map((id) => ({ id, ...AGENDA_NAMES[id] }));

  // An office that has not configured its agenda is told apart from one whose
  // days are merely full: the first sends the citizen to the telephone, the
  // second to another day.
  if (agendas.length === 0) {
    const configured = AGENDA_IDS.some((id) =>
      hasGrid(agendaRules(config, id)),
    );
    return (
      <Page>
        <SchedulingScreen
          {...base}
          unavailable={configured ? "full" : "unconfigured"}
        />
      </Page>
    );
  }

  // Two agendas and none chosen yet: the first question is with whom.
  const agenda: AgendaId | undefined =
    isAgendaId(agendaParam) && agendas.includes(agendaParam)
      ? agendaParam
      : agendas.length === 1
        ? agendas[0]
        : undefined;
  if (!agenda) {
    return (
      <Page>
        <SchedulingScreen {...base} agendas={choices} />
      </Page>
    );
  }

  const rules = { ...agendaRules(config, agenda), holidays };
  const days = offeredDays(rules, now.date);
  const selected = dia && days.includes(dia) ? dia : days[0];
  const taken = await takenTimesByDay(
    tenant.slug,
    days[0],
    days[days.length - 1],
    agenda,
  );
  const dayTaken = taken.get(selected) ?? new Set<string>();
  const nextFreeDay = nextDayWithSlot(rules, days, taken, selected, now);

  return (
    <Page>
      <SchedulingScreen
        {...base}
        agendas={choices}
        agenda={agenda}
        days={days}
        selected={selected}
        times={freeSlots(rules, selected, dayTaken, now)}
        services={servicesOfAgenda(config, agenda)}
        // The times the office narrowed to some services, on this weekday.
        slotServices={
          config.agendas[agenda].slotServices[
            String(weekday(selected)) as `${AgendaWeekday}`
          ] ?? {}
        }
        // The notary's agenda offers the channels he chose for this day;
        // the counter's, the office's modes.
        modes={
          usesChannels(agenda)
            ? channelLabelsOn(config.agendas[agenda], selected)
            : config.modes
        }
        modeHints={
          usesChannels(agenda)
            ? Object.fromEntries(
                channelsOn(config.agendas[agenda], selected).map((channel) => [
                  CHANNEL_NAMES[channel].label,
                  CHANNEL_NAMES[channel].description,
                ]),
              )
            : undefined
        }
        nextFreeDay={nextFreeDay}
        nextFreeTime={
          nextFreeDay
            ? firstFreeSlot(
                rules,
                nextFreeDay,
                taken.get(nextFreeDay) ?? new Set<string>(),
                now,
              )
            : undefined
        }
      />
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-10 md:py-10">
      {children}
    </div>
  );
}
