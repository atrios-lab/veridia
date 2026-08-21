import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { closedDate } from "@/core/scheduling/agenda.ts";
import {
  addDays,
  dayOfMonth,
  formatFullDate,
  formatShortDate,
  nextBusinessDays,
  shortWeekday,
} from "@/core/scheduling/calendar.ts";
import { freeSlots, gridTimes } from "@/core/scheduling/slots.ts";
import {
  appointmentsOn,
  getAgendaConfig,
  liveCountsByDay,
} from "@/lib/appointments.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, officeNow, today } from "@/lib/tenant.ts";
import { AdminIcon } from "../../_components/icon.tsx";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import {
  CloseDayCard,
  ClosedDayCard,
  ReopenDateButton,
} from "./_components/close-day.tsx";
import { type DayRow, DaySlotList } from "./_components/day-agenda.tsx";

export const metadata = { title: "Agenda de atendimentos" };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** How many business days one page of the strip shows. */
const STRIP_DAYS = 7;

/**
 * The day, not a queue of requests. Two query params, both optional: `dia` is
 * the selected date and `de` anchors the strip's page, so paging the week back
 * and forth never loses the day being worked.
 */
export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string; de?: string }>;
}) {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "channels.manage")) notFound();
  const tenant = await getTenant();

  const params = await searchParams;
  const date = ISO.test(params.dia ?? "") ? (params.dia as string) : today();
  const anchor = ISO.test(params.de ?? "") ? (params.de as string) : today();

  const stripDates = nextBusinessDays(anchor, STRIP_DAYS);
  const stripFrom = stripDates[0] ?? anchor;
  const stripTo = stripDates.at(-1) ?? anchor;

  const [config, appointments, counts] = await Promise.all([
    getAgendaConfig(tenant.slug),
    appointmentsOn(tenant.slug, date),
    liveCountsByDay(tenant.slug, stripFrom, stripTo),
  ]);

  const now = officeNow();
  const closed = closedDate(config, date);
  const grid = gridTimes(config, date);
  const live = appointments.filter((a) => a.status !== "cancelled");
  const takenTimes = new Set(live.map((a) => a.slotTime));
  const free = closed ? [] : freeSlots(config, date, takenTimes, now);

  // Every hour the day has: the appointments (any status), plus the grid
  // times nobody holds: offered ones as bookable, spent ones as idle.
  const rows: DayRow[] = [
    ...appointments.map((appointment) => ({
      kind: "appointment" as const,
      time: appointment.slotTime,
      appointment: {
        id: appointment.id,
        slotTime: appointment.slotTime,
        citizenName: appointment.citizenName,
        email: appointment.email,
        phone: appointment.phone,
        cpf: appointment.cpf,
        serviceLabel: appointment.serviceLabel,
        mode: appointment.mode,
        status: appointment.status,
        origin: appointment.origin,
        protocolNumber: appointment.protocolNumber,
        cancelReason: appointment.cancelReason,
      },
    })),
    ...grid
      .filter((time) => !takenTimes.has(time))
      .map((time) => ({
        kind: free.includes(time) ? ("free" as const) : ("idle" as const),
        time,
      })),
  ].sort((a, b) => a.time.localeCompare(b.time));

  const futureClosed = [...config.closedDates]
    .filter((item) => item.date >= today())
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      <AdminPageHeader title="Agenda de atendimentos" />
      <main className="flex flex-col gap-3 px-[30px] py-7">
        <DayStrip
          dates={stripDates}
          selected={date}
          anchor={anchor}
          config={config}
          counts={counts}
        />
        <p className="text-[12px] text-admin-faint">
          Sábado e domingo não têm horários configurados e não aparecem: nem
          aqui, nem no site.
        </p>

        <div className="mt-1.5 grid items-start gap-4.5 lg:grid-cols-[1fr_320px]">
          <section className="overflow-hidden rounded-[14px] border border-admin-border bg-admin-card">
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-4 pb-3">
              <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
                {formatFullDate(date)}
              </h2>
              <span className="text-[12.5px] text-admin-muted">
                {grid.length} {grid.length === 1 ? "horário" : "horários"} ·{" "}
                {live.length} {live.length === 1 ? "agendado" : "agendados"} ·{" "}
                {free.length} {free.length === 1 ? "livre" : "livres"} no site
              </span>
            </div>
            <DaySlotList
              date={date}
              rows={rows}
              services={config.services.map(({ id, label }) => ({ id, label }))}
              modes={config.modes}
              closed={Boolean(closed)}
            />
          </section>

          <aside className="flex flex-col gap-3">
            <Link
              href="/admin/agenda/configuracao"
              className="flex items-center gap-3.5 rounded-[14px] border border-admin-border bg-admin-card px-5 py-4 hover:bg-admin-input-bg"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-admin-input-bg text-admin-primary">
                <AdminIcon name="settings" className="h-4.5 w-4.5" />
              </span>
              <span>
                <span className="block text-[13px] font-bold text-admin-primary">
                  Configurar horários, serviços e modos
                </span>
                <span className="block text-[12px] text-admin-muted">
                  vale para todas as semanas
                </span>
              </span>
            </Link>

            {closed ? (
              <ClosedDayCard date={date} reason={closed.reason} />
            ) : (
              <CloseDayCard
                date={date}
                dateLabel={formatShortDate(date)}
                liveCount={
                  appointments.filter((a) => a.status === "booked").length
                }
              />
            )}

            {futureClosed.length > 0 && (
              <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
                <h3 className="text-[13px] font-bold text-admin-primary">
                  Dias fechados à frente
                </h3>
                <ul className="mt-2.5 flex flex-col gap-2">
                  {futureClosed.map((item) => (
                    <li
                      key={item.date}
                      className="flex items-center justify-between gap-2 text-[12.5px]"
                    >
                      <span className="flex items-center gap-2 text-admin-text">
                        <AdminIcon
                          name="lock"
                          className="h-3.5 w-3.5 text-admin-alert"
                        />
                        {formatShortDate(item.date)}
                        {item.date === today() && " (hoje)"}
                      </span>
                      <ReopenDateButton date={item.date} />
                    </li>
                  ))}
                </ul>
                <p className="mt-2.5 text-[11.5px] leading-relaxed text-admin-faint">
                  Um dia sem nenhum horário configurado não precisa ser fechado:
                  ele já não aparece no site.
                </p>
              </section>
            )}
          </aside>
        </div>
      </main>
    </>
  );
}

/**
 * The week at a glance: one card per business day, occupancy counted over the
 * grid, closed dates flagged. The arrows page by a calendar week and keep the
 * selection, so "which Tuesday was that" is a click, not a date to retype.
 */
function DayStrip({
  dates,
  selected,
  anchor,
  config,
  counts,
}: {
  dates: string[];
  selected: string;
  anchor: string;
  config: Parameters<typeof gridTimes>[0];
  counts: Map<string, number>;
}) {
  const arrowClass =
    "flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-full border border-admin-border bg-admin-card text-admin-muted hover:bg-admin-input-bg";
  return (
    <nav className="flex items-stretch gap-2">
      <Link
        href={`/admin/agenda?dia=${selected}&de=${addDays(anchor, -7)}`}
        aria-label="Dias anteriores"
        className={arrowClass}
      >
        ‹
      </Link>
      <div className="grid flex-1 grid-cols-7 gap-2">
        {dates.map((date) => {
          const isSelected = date === selected;
          const closed = closedDate(config, date);
          const total = gridTimes(config, date).length;
          const occupied = counts.get(date) ?? 0;
          return (
            <Link
              key={date}
              href={`/admin/agenda?dia=${date}&de=${anchor}`}
              aria-current={isSelected ? "date" : undefined}
              className={`rounded-xl border px-3 py-2.5 ${
                isSelected
                  ? "border-admin-primary bg-admin-primary text-white"
                  : "border-admin-border bg-admin-card hover:bg-admin-input-bg"
              }`}
            >
              <span
                className={`flex items-center gap-1.5 text-[11px] font-bold tracking-[0.06em] uppercase ${
                  isSelected ? "text-white/80" : "text-admin-faint"
                }`}
              >
                {shortWeekday(date)}
                <span
                  className={`text-[13px] tracking-normal ${
                    isSelected ? "text-white" : "text-admin-primary"
                  }`}
                >
                  {Number(dayOfMonth(date))}
                </span>
                {date === today() && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-normal normal-case ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-admin-input-bg text-admin-muted"
                    }`}
                  >
                    hoje
                  </span>
                )}
              </span>
              <span
                className={`mt-1 flex items-center gap-1 text-[11.5px] ${
                  closed
                    ? isSelected
                      ? "font-semibold text-white"
                      : "font-semibold text-admin-alert"
                    : isSelected
                      ? "text-white/80"
                      : "text-admin-muted"
                }`}
              >
                {closed ? (
                  <>
                    <AdminIcon name="lock" className="h-3 w-3" />
                    Fechado
                  </>
                ) : (
                  `${occupied} de ${total}${isSelected ? " ocupados" : ""}`
                )}
              </span>
            </Link>
          );
        })}
      </div>
      <Link
        href={`/admin/agenda?dia=${selected}&de=${addDays(anchor, 7)}`}
        aria-label="Próximos dias"
        className={arrowClass}
      >
        ›
      </Link>
    </nav>
  );
}
