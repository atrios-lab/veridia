import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  AGENDA_IDS,
  AGENDA_NAMES,
  type AgendaBook,
  type AgendaId,
  agendaIdOf,
  agendaRules,
  capacityAt,
  channelLabelsOn,
  channelsOn,
  closedDate,
  DEFAULT_CHANNELS,
  hasGrid,
  isAgendaId,
  isRemoteMode,
  slotEndTime,
  usesChannels,
} from "@/core/scheduling/agenda.ts";
import {
  addDays,
  dayOfMonth,
  formatFullDate,
  formatShortDate,
  nextBusinessDays,
  officeHolidays,
  shortWeekday,
  weekday,
} from "@/core/scheduling/calendar.ts";
import { servicesOfAgenda } from "@/core/scheduling/services.ts";
import { freeSlots, gridTimes } from "@/core/scheduling/slots.ts";
import { awaitingConfirmation } from "@/lib/appointment-reminders.ts";
import {
  AGENDAS_SHARE_TIMES,
  appointmentsOn,
  getAgendaConfig,
  listAppointmentAttachments,
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
import { DayChannelsCard } from "./_components/day-channels.tsx";

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
  searchParams: Promise<{ dia?: string; de?: string; agenda?: string }>;
}) {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "channels.manage")) notFound();
  const tenant = await getTenant();

  const params = await searchParams;
  const date = ISO.test(params.dia ?? "") ? (params.dia as string) : today();
  const anchor = ISO.test(params.de ?? "") ? (params.de as string) : today();
  const agenda: AgendaId = isAgendaId(params.agenda) ? params.agenda : "geral";

  const stripDates = nextBusinessDays(
    anchor,
    STRIP_DAYS,
    officeHolidays(tenant),
  );
  const stripFrom = stripDates[0] ?? anchor;
  const stripTo = stripDates.at(-1) ?? anchor;

  const [agendaConfig, dayAppointments, counts, unconfirmed] =
    await Promise.all([
      getAgendaConfig(tenant.slug),
      appointmentsOn(tenant.slug, date),
      liveCountsByDay(tenant.slug, stripFrom, stripTo, agenda),
      awaitingConfirmation(tenant.slug, officeNow()),
    ]);

  // The office's own days off ride along, so its holidays close the day
  // here as they do on the public page.
  const config = {
    ...agendaRules(agendaConfig, agenda),
    holidays: officeHolidays(tenant),
  };
  const now = officeNow();
  const closed = closedDate(config, date);
  const grid = gridTimes(config, date);
  const appointments = dayAppointments.filter(
    (a) => agendaIdOf(a.agenda) === agenda,
  );
  const live = appointments.filter((a) => a.status !== "cancelled");
  // What citizens sent ahead from the consult, by appointment.
  const filesByAppointment = new Map<string, { id: string; name: string }[]>();
  for (const file of await listAppointmentAttachments(
    tenant.slug,
    appointments.map((a) => a.id),
  ).catch(() => [])) {
    const list = filesByAppointment.get(file.appointmentId) ?? [];
    // Numbered, not named: the stored name is positional on purpose, and
    // "Documento 2" reads better at the counter than "anexo-2".
    list.push({ id: file.id, name: `Documento ${list.length + 1}` });
    filesByAppointment.set(file.appointmentId, list);
  }
  // Live appointments per time, against the time's vacancies: a time is
  // full only once every attendant who starts at it has a citizen.
  const liveAt = new Map<string, number>();
  for (const a of live)
    liveAt.set(a.slotTime, (liveAt.get(a.slotTime) ?? 0) + 1);
  const book = agendaConfig.agendas[agenda];
  const vacanciesAt = (time: string) =>
    capacityAt(book, weekday(date), time) - (liveAt.get(time) ?? 0);
  const takenTimes = new Set(
    [...liveAt.keys()].filter((time) => vacanciesAt(time) <= 0),
  );
  // While the two agendas share their times, an hour the other one holds is
  // not free here either: the database would refuse it.
  const heldElsewhere = new Map(
    AGENDAS_SHARE_TIMES
      ? dayAppointments
          .filter(
            (a) => a.status !== "cancelled" && agendaIdOf(a.agenda) !== agenda,
          )
          .map((a) => [a.slotTime, AGENDA_NAMES[agendaIdOf(a.agenda)].short])
      : [],
  );
  const free = closed
    ? []
    : freeSlots(
        config,
        date,
        new Set([...takenTimes, ...heldElsewhere.keys()]),
        now,
      );
  // What the site still offers today, in citizens: every vacancy of every
  // offered time.
  const freeVacancies = free.reduce(
    (sum, time) => sum + Math.max(0, vacanciesAt(time)),
    0,
  );
  const otherAgendaCounts = AGENDA_IDS.filter((id) => id !== agenda).map(
    (id) => ({
      id,
      count: dayAppointments.filter(
        (a) => a.status !== "cancelled" && agendaIdOf(a.agenda) === id,
      ).length,
    }),
  );

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
        serviceDetails: appointment.serviceDetails,
        status: appointment.status,
        origin: appointment.origin,
        protocolNumber: appointment.protocolNumber,
        cancelReason: appointment.cancelReason,
        files: filesByAppointment.get(appointment.id) ?? [],
        canDeclare:
          appointment.status === "attended" && !isRemoteMode(appointment.mode),
        awaitingConfirmation:
          appointment.status === "booked" &&
          (appointment.date < now.date ||
            (appointment.date === now.date &&
              slotEndTime(appointment.slotTime) <= now.time)),
      },
    })),
    ...grid
      .filter((time) => !takenTimes.has(time))
      // A past time that someone held needs no "ficou livre" row as well.
      .filter((time) => free.includes(time) || !liveAt.has(time))
      .map((time): DayRow => {
        if (free.includes(time)) {
          return { kind: "free", time, vacancies: vacanciesAt(time) };
        }
        const heldBy = heldElsewhere.get(time);
        return heldBy ? { kind: "held", time, heldBy } : { kind: "idle", time };
      }),
  ].sort((a, b) => a.time.localeCompare(b.time));

  const futureClosed = [...config.closedDates]
    .filter((item) => item.date >= today())
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      <AdminPageHeader title="Agenda de atendimentos" />
      <main className="flex flex-col gap-3 px-[30px] py-7">
        <nav aria-label="Agendas" className="flex flex-wrap gap-2">
          {AGENDA_IDS.map((id) => {
            const chosen = id === agenda;
            const other = otherAgendaCounts.find((item) => item.id === id);
            return (
              <Link
                key={id}
                href={`/admin/agenda?agenda=${id}&dia=${date}&de=${anchor}`}
                aria-current={chosen ? "page" : undefined}
                className={`rounded-full border px-4 py-2 text-[13px] font-semibold ${
                  chosen
                    ? "border-admin-primary bg-admin-primary text-white"
                    : "border-admin-border bg-admin-card text-admin-text hover:bg-admin-input-bg"
                }`}
              >
                {AGENDA_NAMES[id].name}
                {!chosen && other && other.count > 0 && (
                  <span className="ml-1.5 rounded-full bg-admin-input-bg px-1.5 py-0.5 text-[11px] text-admin-muted">
                    {other.count} no dia
                  </span>
                )}
                {!hasGrid(agendaRules(agendaConfig, id)) && (
                  <span
                    className={`ml-1.5 text-[11px] font-normal ${chosen ? "text-white/80" : "text-admin-faint"}`}
                  >
                    · sem horários
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <DayStrip
          book={agendaConfig.agendas[agenda]}
          agenda={agenda}
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
                {freeVacancies}{" "}
                {freeVacancies === 1 ? "vaga livre" : "vagas livres"} no site
              </span>
            </div>
            <DaySlotList
              agenda={agenda}
              date={date}
              rows={rows}
              services={servicesOfAgenda(agendaConfig, agenda).map(
                ({ id, label }) => ({ id, label }),
              )}
              modes={
                usesChannels(agenda)
                  ? channelLabelsOn(agendaConfig.agendas[agenda], date)
                  : agendaConfig.modes
              }
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
                  Configurar as agendas
                </span>
                <span className="block text-[12px] text-admin-muted">
                  dias, horários e serviços do cartório e do tabelião
                </span>
              </span>
            </Link>

            {unconfirmed.length > 0 && (
              <section className="rounded-[14px] border-2 border-admin-warning-bg bg-admin-card px-5 py-4">
                <h3 className="text-[13px] font-bold text-admin-primary">
                  Aguardando confirmação ({unconfirmed.length})
                </h3>
                <p className="mt-1 text-[12px] leading-relaxed text-admin-muted">
                  O horário passou e ninguém marcou se a pessoa foi atendida ou
                  não compareceu.
                </p>
                <ul className="mt-2.5 flex flex-col gap-1.5">
                  {unconfirmed.slice(0, 6).map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/admin/agenda?agenda=${agendaIdOf(item.agenda)}&dia=${item.date}`}
                        className="flex justify-between gap-2 text-[12.5px] text-admin-text hover:underline"
                      >
                        <span className="min-w-0 truncate">
                          {item.citizenName}
                        </span>
                        <span className="shrink-0 tabular-nums text-admin-muted">
                          {item.date === today()
                            ? "hoje"
                            : formatShortDate(item.date)}{" "}
                          {item.slotTime}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {unconfirmed.length > 6 && (
                  <p className="mt-1.5 text-[11.5px] text-admin-faint">
                    e mais {unconfirmed.length - 6}.
                  </p>
                )}
              </section>
            )}

            {usesChannels(agenda) && !closed && grid.length > 0 && (
              <DayChannelsCard
                date={date}
                dateLabel={formatShortDate(date)}
                channels={channelsOn(agendaConfig.agendas[agenda], date)}
                own={agendaConfig.agendas[agenda].dayChannels.some(
                  (day) => day.date === date,
                )}
                weekdayChannels={
                  agendaConfig.agendas[agenda].channels[
                    String(weekday(date)) as "1" | "2" | "3" | "4" | "5"
                  ] ?? DEFAULT_CHANNELS
                }
              />
            )}

            {closed ? (
              <ClosedDayCard date={date} reason={closed.reason} />
            ) : (
              <CloseDayCard
                date={date}
                dateLabel={formatShortDate(date)}
                // Closing a date closes both agendas, so it counts both.
                liveCount={
                  dayAppointments.filter((a) => a.status === "booked").length
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
  agenda,
  dates,
  selected,
  anchor,
  config,
  counts,
  book,
}: {
  agenda: AgendaId;
  dates: string[];
  selected: string;
  anchor: string;
  config: Parameters<typeof gridTimes>[0];
  counts: Map<string, number>;
  /** The agenda's vacancies per time, so a day counts citizens, not hours. */
  book: Pick<AgendaBook, "slotCapacity">;
}) {
  const arrowClass =
    "flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-full border border-admin-border bg-admin-card text-admin-muted hover:bg-admin-input-bg";
  return (
    <nav className="flex items-stretch gap-2">
      <Link
        href={`/admin/agenda?agenda=${agenda}&dia=${selected}&de=${addDays(anchor, -7)}`}
        aria-label="Dias anteriores"
        className={arrowClass}
      >
        ‹
      </Link>
      <div className="grid flex-1 grid-cols-7 gap-2">
        {dates.map((date) => {
          const isSelected = date === selected;
          const closed = closedDate(config, date);
          const total = gridTimes(config, date).reduce(
            (sum, time) => sum + capacityAt(book, weekday(date), time),
            0,
          );
          const occupied = counts.get(date) ?? 0;
          return (
            <Link
              key={date}
              href={`/admin/agenda?agenda=${agenda}&dia=${date}&de=${anchor}`}
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
        href={`/admin/agenda?agenda=${agenda}&dia=${selected}&de=${addDays(anchor, 7)}`}
        aria-label="Próximos dias"
        className={arrowClass}
      >
        ›
      </Link>
    </nav>
  );
}
