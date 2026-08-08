import { nextBusinessDays } from "@/core/scheduling/calendar.ts";
import {
  firstFreeSlot,
  hasFreeSlot,
  nextDayWithSlot,
  OFFERED_DAYS,
  slots,
} from "@/core/scheduling/slots.ts";
import { appointmentOccupancy } from "@/lib/service-request.ts";
import { today } from "@/lib/tenant.ts";
import { requireSection } from "../_lib/section.ts";
import { SchedulingScreen } from "./appointment-form.tsx";

export const metadata = { title: "Agendar atendimento" };

/**
 * The chosen day lives in the query string, so the bands are rendered on the
 * server with the office's real occupancy. Back button, bookmark and a shared
 * link all behave the way the citizen expects, and availability is never
 * guessed in the browser.
 */
export default async function SchedulingPage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string }>;
}) {
  const tenant = await requireSection("agendamento");
  const { dia } = await searchParams;

  const days = nextBusinessDays(today(), OFFERED_DAYS);
  const selected = dia && days.includes(dia) ? dia : days[0];

  const occupancy = await appointmentOccupancy(
    tenant.slug,
    days[0],
    days[days.length - 1],
  );
  const dayBands = occupancy.get(selected) ?? {};
  const nextFreeDay = nextDayWithSlot(
    tenant.scheduling,
    days,
    occupancy,
    selected,
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-10 md:py-10">
      <SchedulingScreen
        openingHours={tenant.openingHours}
        whatsapp={tenant.contacts.whatsapp}
        days={days}
        selected={selected}
        bands={slots(tenant.scheduling, dayBands)}
        dayIsFull={!hasFreeSlot(tenant.scheduling, dayBands)}
        nextFreeDay={nextFreeDay}
        nextFreeHour={
          nextFreeDay
            ? firstFreeSlot(tenant.scheduling, occupancy.get(nextFreeDay) ?? {})
                ?.hour
            : undefined
        }
      />
    </div>
  );
}
