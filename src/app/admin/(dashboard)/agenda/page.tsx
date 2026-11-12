import { ChevronLeft, ChevronRight } from "lucide-react";
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
  holidayName,
  type IsoDate,
  isBusinessDay,
  isWeekend,
  officeHolidays,
  shortWeekday,
  weekday,
} from "@/core/scheduling/calendar.ts";
import { servicesOfAgenda } from "@/core/scheduling/services.ts";
import {
  freeSlots,
  gridTimes,
  type OfficeAgenda,
  whyNotOffered,
} from "@/core/scheduling/slots.ts";
import { awaitingConfirmation } from "@/lib/appointment-reminders.ts";
import {
  AGENDAS_SHARE_TIMES,
  appointmentsOn,
  bookedFrom,
  getAgendaConfig,
  listAppointmentAttachments,
  liveCountsByDay,
} from "@/lib/appointments.ts";
import { getSession } from "@/lib/session.ts";
import { getGuideSettings } from "@/lib/tax-guides.ts";
import { getTenant, officeNow, today } from "@/lib/tenant.ts";
import { AdminIcon } from "../../_components/icon.tsx";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import { Badge } from "../../_ui/badge.tsx";
import { buttonVariants } from "../../_ui/button.tsx";
import { cn } from "../../_ui/cn.ts";
import {
  CloseDayCard,
  ClosedDayCard,
  ReopenDateButton,
} from "./_components/close-day.tsx";
import { type DayRow, DaySlotList } from "./_components/day-agenda.tsx";
import { DayChannelsCard } from "./_components/day-channels.tsx";

export const metadata = { title: "Agenda de atendimentos" };

/**
 * Each agenda's colour and icon, the same in the tabs and the panel. The
 * neutral panel has one ink, the navy, so the two agendas tell themselves
 * apart by icon and name; the colour only says which one is open.
 */
const AGENDA_TONE: Record<
  AgendaId,
  {
    icon: "users" | "shield";
    chosen: string;
    idle: string;
    iconBg: string;
    badge: string;
    chip: string;
  }
> = {
  geral: {
    icon: "users",
    chosen: "border-primary bg-primary text-primary-foreground",
    idle: "border-primary/40 bg-card text-primary hover:bg-muted",
    iconBg: "bg-muted text-primary",
    badge: "bg-primary text-primary-foreground",
    chip: "bg-primary text-primary-foreground",
  },
  tabeliao: {
    icon: "shield",
    chosen: "border-primary bg-primary text-primary-foreground",
    idle: "border-primary/40 bg-card text-primary hover:bg-muted",
    iconBg: "bg-muted text-primary",
    badge: "bg-primary text-primary-foreground",
    chip: "bg-primary text-primary-foreground",
  },
};

/**
 * Who comes next, across both agendas, at a glance: the name, the service,
 * when, and which agenda (decision of 11/11/2026).
 */
function UpcomingPanel({
  items,
  todayCounts,
  weekCount,
}: {
  items: {
    id: string;
    date: string;
    time: string;
    name: string;
    service: string;
    agenda: AgendaId;
  }[];
  todayCounts: Record<string, number>;
  weekCount: number;
}) {
  const when = (date: string) =>
    date === today()
      ? "Hoje"
      : date === addDays(today(), 1)
        ? "Amanhã"
        : formatShortDate(date);
  return (
    <section className="rounded-xl border bg-card px-5 py-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="mr-auto text-lg font-semibold text-foreground">
          Próximos agendamentos
        </h2>
        {AGENDA_IDS.map((id) => (
          <Badge key={id} className={cn("h-6 px-3", AGENDA_TONE[id].chip)}>
            Hoje · {AGENDA_NAMES[id].short}: {todayCounts[id] ?? 0}
          </Badge>
        ))}
        <Badge className="h-6 bg-muted px-3 text-foreground">
          Próximos 7 dias: {weekCount}
        </Badge>
      </div>
      {items.length === 0 ? (
        <p className="mt-2.5 text-sm text-muted-foreground">
          Nenhum agendamento pela frente.
        </p>
      ) : (
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/admin/agenda?agenda=${item.agenda}&dia=${item.date}`}
                className="flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/50"
              >
                <span
                  className={`h-9 w-1.5 shrink-0 rounded-full ${AGENDA_TONE[item.agenda].badge}`}
                  aria-hidden
                />
                <span className="w-[86px] shrink-0 text-xs leading-tight">
                  <span className="block font-semibold text-foreground">
                    {when(item.date)}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {item.time}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {item.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.service}
                  </span>
                </span>
                <Badge
                  className={cn("shrink-0", AGENDA_TONE[item.agenda].chip)}
                >
                  {AGENDA_NAMES[item.agenda].short}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** The next `count` weekdays from `from` (included), holidays among them. */
function weekdaysFrom(from: IsoDate, count: number): IsoDate[] {
  const days: IsoDate[] = [];
  for (let cursor = from; days.length < count; cursor = addDays(cursor, 1)) {
    if (!isWeekend(cursor)) days.push(cursor);
  }
  return days;
}

/** How many weekdays one page of the strip shows. */
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
  if (
    !session ||
    !can(session.user.role ?? "", "channels.manage", session.user.permissions)
  )
    notFound();
  const tenant = await getTenant();

  const params = await searchParams;
  const date = ISO.test(params.dia ?? "") ? (params.dia as string) : today();
  const anchor = ISO.test(params.de ?? "") ? (params.de as string) : today();
  const agenda: AgendaId = isAgendaId(params.agenda) ? params.agenda : "geral";

  const holidays = officeHolidays(tenant);
  // Weekdays, holidays included: a holiday shows in the strip as closed and
  // named, rather than the week silently skipping it.
  const stripDates = weekdaysFrom(anchor, STRIP_DAYS);
  const stripFrom = stripDates[0] ?? anchor;
  const stripTo = stripDates.at(-1) ?? anchor;

  const [agendaConfig, dayAppointments, counts, unconfirmed, upcoming] =
    await Promise.all([
      getAgendaConfig(tenant.slug),
      appointmentsOn(tenant.slug, date),
      liveCountsByDay(tenant.slug, stripFrom, stripTo, agenda),
      awaitingConfirmation(tenant.slug, officeNow()),
      bookedFrom(tenant.slug, today()),
    ]);

  // The office's own days off ride along, so its holidays close the day
  // here as they do on the public page.
  const config = { ...agendaRules(agendaConfig, agenda), holidays };
  const now = officeNow();
  const closed = closedDate(config, date);
  // A holiday or a weekend: the agenda is shut that day on the site and at
  // the counter, whatever the grid says, and the panel says which one.
  const dayOff =
    !closed && !isBusinessDay(date, holidays)
      ? whyNotOffered(config, date)
      : undefined;
  // Still booked on a day the office no longer receives on: a holiday added
  // after the booking, a law day switched back on, a weekday that lost its
  // times. Nothing is cancelled for the office; it is told, so the citizen
  // is not.
  const stranded = upcoming.flatMap((appointment) => {
    const reason = whyNotOffered(
      {
        ...agendaRules(agendaConfig, agendaIdOf(appointment.agenda)),
        holidays,
      },
      appointment.date,
    );
    return reason ? [{ appointment, reason }] : [];
  });
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
    // "Enviou antes": what the citizen sent, not the office's own files.
    { citizenOnly: true },
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

  // Who may sign the office's papers: the same list as the guias'.
  const signers =
    (await getGuideSettings(tenant).catch(() => null))?.signers.map(
      ({ name, title }) => ({ name, title }),
    ) ?? [];

  const futureClosed = [...config.closedDates]
    .filter((item) => item.date >= today())
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      <AdminPageHeader title="Agenda de atendimentos" />
      <main className="flex flex-col gap-3 px-4 pt-6 pb-8 md:px-8">
        <UpcomingPanel
          items={upcoming
            .filter(
              (a) =>
                a.date > now.date ||
                (a.date === now.date && slotEndTime(a.slotTime) > now.time),
            )
            .slice(0, 8)
            .map((a) => ({
              id: a.id,
              date: a.date,
              time: a.slotTime,
              name: a.citizenName,
              service: a.serviceLabel,
              agenda: agendaIdOf(a.agenda),
            }))}
          todayCounts={Object.fromEntries(
            AGENDA_IDS.map((id) => [
              id,
              upcoming.filter(
                (a) => a.date === now.date && agendaIdOf(a.agenda) === id,
              ).length,
            ]),
          )}
          weekCount={
            upcoming.filter((a) => a.date <= addDays(now.date, 6)).length
          }
        />
        {/* The two agendas, each with its own colour and the day's count,
            so it is never in doubt which one is open (decision of
            11/11/2026). */}
        <nav aria-label="Agendas" className="grid gap-2.5 sm:grid-cols-2">
          {AGENDA_IDS.map((id) => {
            const chosen = id === agenda;
            const count =
              id === agenda
                ? live.length
                : (otherAgendaCounts.find((item) => item.id === id)?.count ??
                  0);
            const tone = AGENDA_TONE[id];
            return (
              <Link
                key={id}
                href={`/admin/agenda?agenda=${id}&dia=${date}&de=${anchor}`}
                aria-current={chosen ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3.5 rounded-xl border-2 px-4 py-3.5 transition-colors",
                  chosen ? tone.chosen : tone.idle,
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                    chosen ? "bg-primary-foreground/20" : tone.iconBg,
                  )}
                >
                  <AdminIcon name={tone.icon} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg leading-tight font-semibold">
                    {AGENDA_NAMES[id].name}
                  </span>
                  <span
                    className={cn(
                      "block text-xs",
                      chosen
                        ? "text-primary-foreground/85"
                        : "text-muted-foreground",
                    )}
                  >
                    {hasGrid(agendaRules(agendaConfig, id))
                      ? `${count} ${count === 1 ? "agendado" : "agendados"} em ${formatShortDate(date)}`
                      : "sem horários configurados"}
                  </span>
                </span>
                {count > 0 && (
                  <span
                    className={cn(
                      "flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-sm font-semibold tabular-nums",
                      chosen
                        ? "bg-primary-foreground text-primary"
                        : tone.badge,
                    )}
                  >
                    {count}
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
        <p className="text-xs text-muted-foreground">
          Sábado e domingo não têm horários configurados e não aparecem: nem
          aqui, nem no site. Feriado aparece como fechado e não é oferecido no
          site.
        </p>

        <div className="mt-1.5 grid items-start gap-6 lg:grid-cols-[1fr_320px]">
          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-4 pb-3">
              <h2 className="text-lg font-semibold text-foreground">
                {formatFullDate(date)}
              </h2>
              <span className="text-xs text-muted-foreground">
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
              closed={Boolean(closed) || Boolean(dayOff)}
              signers={signers}
            />
          </section>

          <aside className="flex flex-col gap-3">
            <Link
              href="/admin/agenda/configuracao"
              className="flex items-center gap-3.5 rounded-xl border bg-card px-5 py-4 transition-colors hover:bg-muted/50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                <AdminIcon name="settings" className="h-4.5 w-4.5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-foreground">
                  Configurar as agendas
                </span>
                <span className="block text-xs text-muted-foreground">
                  dias, horários e serviços do cartório e do tabelião
                </span>
              </span>
            </Link>

            {stranded.length > 0 && (
              <section className="rounded-xl border-2 border-warning/40 bg-card px-5 py-4">
                <h3 className="text-sm font-semibold text-foreground">
                  Agendados em dia sem atendimento ({stranded.length})
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Foram marcados antes de o dia virar feriado ou ficar sem
                  atendimento. O site já não oferece esses dias. Abra o dia para
                  remarcar com o cidadão ou cancelar (o Cancelar avisa por
                  e-mail).
                </p>
                <ul className="mt-2.5 flex flex-col gap-2">
                  {stranded.slice(0, 8).map(({ appointment, reason }) => (
                    <li key={appointment.id}>
                      <Link
                        href={`/admin/agenda?agenda=${agendaIdOf(appointment.agenda)}&dia=${appointment.date}`}
                        className="block text-xs text-foreground hover:underline"
                      >
                        <span className="flex justify-between gap-2">
                          <span className="min-w-0 truncate font-medium">
                            {appointment.citizenName}
                          </span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {formatShortDate(appointment.date)}{" "}
                            {appointment.slotTime}
                          </span>
                        </span>
                        <span className="block text-xs text-warning-text">
                          {reason}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {stranded.length > 8 && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    e mais {stranded.length - 8}.
                  </p>
                )}
              </section>
            )}

            {unconfirmed.length > 0 && (
              <section className="rounded-xl border-2 border-warning/40 bg-card px-5 py-4">
                <h3 className="text-sm font-semibold text-foreground">
                  Aguardando confirmação ({unconfirmed.length})
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  O horário passou e ninguém marcou se a pessoa foi atendida ou
                  não compareceu.
                </p>
                <ul className="mt-2.5 flex flex-col gap-1.5">
                  {unconfirmed.slice(0, 6).map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/admin/agenda?agenda=${agendaIdOf(item.agenda)}&dia=${item.date}`}
                        className="flex justify-between gap-2 text-xs text-foreground hover:underline"
                      >
                        <span className="min-w-0 truncate">
                          {item.citizenName}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
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
                  <p className="mt-1.5 text-xs text-muted-foreground">
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
            ) : dayOff ? (
              <section className="rounded-xl border border-warning/30 bg-warning-soft px-5 py-4">
                <h3 className="text-sm font-semibold text-warning-text">
                  Sem atendimento neste dia
                </h3>
                <p className="mt-1 text-xs text-warning-text">{dayOff}</p>
                <p className="mt-1 text-xs leading-relaxed text-warning-text">
                  As duas agendas ficam fechadas: o site não oferece esta data e
                  o balcão não reserva. Os feriados do cartório ficam em{" "}
                  <Link
                    href="/admin/configuracoes"
                    className="font-medium underline"
                  >
                    Configurações
                  </Link>
                  .
                </p>
              </section>
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
              <section className="rounded-xl border bg-card px-5 py-4">
                <h3 className="text-sm font-semibold text-foreground">
                  Dias fechados à frente
                </h3>
                <ul className="mt-2.5 flex flex-col gap-2">
                  {futureClosed.map((item) => (
                    <li
                      key={item.date}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="flex items-center gap-2 text-foreground">
                        <AdminIcon
                          name="lock"
                          className="h-3.5 w-3.5 text-muted-foreground"
                        />
                        {formatShortDate(item.date)}
                        {item.date === today() && " (hoje)"}
                      </span>
                      <ReopenDateButton date={item.date} />
                    </li>
                  ))}
                </ul>
                <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
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
  config: OfficeAgenda;
  counts: Map<string, number>;
  /** The agenda's vacancies per time, so a day counts citizens, not hours. */
  book: Pick<AgendaBook, "slotCapacity">;
}) {
  const arrowClass = cn(
    buttonVariants({ variant: "outline", size: "icon" }),
    "self-center rounded-full text-muted-foreground",
  );
  return (
    <nav className="flex items-stretch gap-2">
      <Link
        href={`/admin/agenda?agenda=${agenda}&dia=${selected}&de=${addDays(anchor, -7)}`}
        aria-label="Dias anteriores"
        className={arrowClass}
      >
        <ChevronLeft aria-hidden="true" />
      </Link>
      <div className="grid flex-1 grid-cols-7 gap-2">
        {dates.map((date) => {
          const isSelected = date === selected;
          // A holiday reads as closed too, by its own word: it is not a date
          // the office closed by hand, so there is nothing to reopen here.
          const holiday = closedDate(config, date)
            ? undefined
            : holidayName(date, config.holidays);
          const closed = closedDate(config, date) ?? holiday;
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
              className={cn(
                "rounded-xl border px-3 py-2.5 transition-colors",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : closed
                    ? "bg-muted hover:bg-muted/70"
                    : occupied > 0
                      ? "border-primary/30 bg-primary/10 hover:bg-primary/15"
                      : "bg-card hover:bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium",
                  isSelected
                    ? "text-primary-foreground/80"
                    : "text-muted-foreground",
                )}
              >
                {shortWeekday(date)}
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    isSelected ? "text-primary-foreground" : "text-foreground",
                  )}
                >
                  {Number(dayOfMonth(date))}
                </span>
                {date === today() && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-xs font-medium",
                      isSelected
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    hoje
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "mt-1 flex items-center gap-1 text-xs",
                  closed
                    ? isSelected
                      ? "font-medium text-primary-foreground"
                      : "font-medium text-muted-foreground"
                    : isSelected
                      ? "text-primary-foreground/80"
                      : "text-muted-foreground",
                )}
              >
                {closed ? (
                  <>
                    <AdminIcon name="lock" className="h-3 w-3" />
                    {holiday ? "Feriado" : "Fechado"}
                  </>
                ) : occupied > 0 ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 font-semibold",
                      isSelected ? "text-primary-foreground" : "text-primary",
                    )}
                  >
                    <span className="relative flex h-2 w-2">
                      <span
                        className={cn(
                          "absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping",
                          isSelected ? "bg-primary-foreground" : "bg-primary",
                        )}
                      />
                      <span
                        className={cn(
                          "relative inline-flex h-2 w-2 rounded-full",
                          isSelected ? "bg-primary-foreground" : "bg-primary",
                        )}
                      />
                    </span>
                    {occupied} {occupied === 1 ? "agendado" : "agendados"}
                  </span>
                ) : (
                  `0 de ${total}`
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
        <ChevronRight aria-hidden="true" />
      </Link>
    </nav>
  );
}
