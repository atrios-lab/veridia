import { hasGrid } from "@/core/scheduling/agenda.ts";
import {
  firstFreeSlot,
  freeSlots,
  nextDayWithSlot,
  offeredDays,
} from "@/core/scheduling/slots.ts";
import { getAgendaConfig, takenTimesByDay } from "@/lib/appointments.ts";
import { officeNow } from "@/lib/tenant.ts";
import { requireSection } from "../_lib/section.ts";
import { SchedulingScreen } from "./appointment-form.tsx";

export const metadata = { title: "Agendar atendimento" };

/**
 * The chosen day lives in the query string, so the times are rendered on the
 * server against the office's real bookings. Back button, bookmark and a
 * shared link all behave the way the citizen expects, and availability is
 * never guessed in the browser.
 */
export default async function SchedulingPage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string }>;
}) {
  const tenant = await requireSection("agendamento");
  const { dia } = await searchParams;

  const config = await getAgendaConfig(tenant.slug);
  const now = officeNow();
  const days = offeredDays(config, now.date);

  // An office that has not configured its agenda is told apart from one whose
  // days are merely full: the first sends the citizen to the telephone, the
  // second to another day.
  if (days.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-10 md:py-10">
        <SchedulingScreen
          openingHours={tenant.openingHours}
          phone={tenant.contacts.phone}
          whatsapp={tenant.contacts.whatsapp}
          unavailable={hasGrid(config) ? "full" : "unconfigured"}
        />
      </div>
    );
  }

  const selected = dia && days.includes(dia) ? dia : days[0];
  const taken = await takenTimesByDay(
    tenant.slug,
    days[0],
    days[days.length - 1],
  );
  const dayTaken = taken.get(selected) ?? new Set<string>();
  const nextFreeDay = nextDayWithSlot(config, days, taken, selected, now);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-10 md:py-10">
      <SchedulingScreen
        openingHours={tenant.openingHours}
        phone={tenant.contacts.phone}
        whatsapp={tenant.contacts.whatsapp}
        days={days}
        selected={selected}
        times={freeSlots(config, selected, dayTaken, now)}
        services={config.services}
        modes={config.modes}
        nextFreeDay={nextFreeDay}
        nextFreeTime={
          nextFreeDay
            ? firstFreeSlot(
                config,
                nextFreeDay,
                taken.get(nextFreeDay) ?? new Set<string>(),
                now,
              )
            : undefined
        }
      />
    </div>
  );
}
