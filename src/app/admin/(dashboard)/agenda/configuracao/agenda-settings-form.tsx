"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AGENDA_IDS,
  AGENDA_NAMES,
  type AgendaId,
  ATTENDANCE_CHANNELS,
  type AttendanceChannel,
  CHANNEL_NAMES,
  DEFAULT_CHANNELS,
  ownServiceId,
  previousDayWithTimes,
  pruneSlotServices,
  usesChannels,
} from "@/core/scheduling/agenda.ts";
import {
  dayOfMonth,
  isBusinessDay,
  longWeekday,
  type OfficeHolidays,
  weekday,
} from "@/core/scheduling/calendar.ts";
import {
  BASE_CHECKLIST,
  COUNTER_SERVICES,
  counterServicesByGroup,
  suggestedServiceIds,
} from "@/core/scheduling/services.ts";
import { AdminIcon } from "../../../_components/icon.tsx";
import { Badge } from "../../../_ui/badge.tsx";
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import { cn } from "../../../_ui/cn.ts";
import { Input } from "../../../_ui/input.tsx";
import { type ActionState, saveAgenda } from "../actions.ts";
import { SuggestCard } from "./suggest-card.tsx";

type Grid = Record<string, string[]>;
/** weekday -> time -> the only services that time takes. */
type SlotServicesDraft = Record<string, Record<string, string[]>>;
/** weekday -> time -> how many citizens it takes at once (absent: one). */
type SlotCapacityDraft = Record<string, Record<string, number>>;

interface BookDraft {
  grid: Grid;
  slotServices: SlotServicesDraft;
  slotCapacity: SlotCapacityDraft;
  serviceIds: string[];
  /** The notary's channels per weekday; empty for the counter's agenda. */
  channels: Record<string, AttendanceChannel[]>;
}

type Books = Record<AgendaId, BookDraft>;

export interface OwnServiceDraft {
  id: string;
  label: string;
  bring: string[];
}

/** A service's list as saved: what the citizen gets for it. */
export interface ListSummary {
  items: string[];
  /** Changed by the office, not the catalogue's. */
  edited: boolean;
  /** The office attached its own sheet. */
  hasFile: boolean;
}

/** The editor of one service's list. */
function listHref(id: string): string {
  return `/admin/agenda/configuracao/lista/${encodeURIComponent(id)}`;
}

interface Draft {
  agendas: Books;
  services: OwnServiceDraft[];
  modes: string[];
}

/** The modes a serventia actually offers in practice, with the panel's own
 * explanation of each. A mode already saved outside this list still renders
 * as a card, so an exotic configuration survives the redesign. */
const KNOWN_MODES: Array<{ label: string; description: string }> = [
  {
    label: "Presencial",
    description: "O cidadão comparece ao cartório no horário marcado.",
  },
  {
    label: "On-line",
    description: "Videochamada: o link vai no e-mail de confirmação.",
  },
  {
    label: "Diligência",
    description: "A serventia vai até o cidadão.",
  },
  {
    label: "Drive-thru",
    description: "Atendimento rápido sem o cidadão sair do carro.",
  },
];

const cardClass = "rounded-xl border bg-card px-5 py-4";
const inputClass = "bg-background";

/**
 * Both agendas as structured state: chips for times, ticks for services,
 * cards for modes, and a live preview computed from what is on the screen,
 * not from what was last saved. One JSON field carries it all to the action,
 * where the core's schemas remain the referee.
 */
export function AgendaSettingsForm({
  initial,
  lists,
  weekdays,
  closedDates,
  takenByDate,
  futureLive,
  today,
  holidays,
}: {
  initial: Draft;
  /** Per service id (catalogue and saved own services), its list now. */
  lists: Record<string, ListSummary>;
  weekdays: Array<{ day: string; label: string }>;
  closedDates: string[];
  /** date -> times already held, for the preview's strikethroughs. */
  takenByDate: Record<string, string[]>;
  /** agenda -> `${weekday}|${time}` -> live future appointments there. */
  futureLive: Record<AgendaId, Record<string, number>>;
  today: string;
  /** The office's own days off, so the preview skips them as the public
   * page does. */
  holidays: OfficeHolidays;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [baseline, setBaseline] = useState<Draft>(initial);
  const [tab, setTab] = useState<AgendaId>("geral");

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveAgenda,
    { status: "idle" },
  );

  // One toast per successful save; the baseline moves so the bar goes away.
  const lastState = useRef<ActionState>(state);
  useEffect(() => {
    if (state === lastState.current) return;
    lastState.current = state;
    if (state.status === "success") {
      toast.success(state.message ?? "Agenda salva.");
      setBaseline(draft);
    }
  }, [state, draft]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const book = draft.agendas[tab];
  const setBook = (next: BookDraft) =>
    setDraft({ ...draft, agendas: { ...draft.agendas, [tab]: next } });
  const other: AgendaId = tab === "geral" ? "tabeliao" : "geral";

  return (
    <form
      action={formAction}
      className="grid items-start gap-6 lg:grid-cols-[1fr_360px]"
    >
      <input type="hidden" name="config" value={JSON.stringify(draft)} />

      <div className="flex flex-col gap-6">
        <section className={cardClass}>
          <h2 className="text-base font-semibold text-foreground">Agendas</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            O cartório tem duas agendas, cada uma com os seus dias, horários e
            serviços. Uma agenda sem horários não aparece no site.
          </p>
          <div role="tablist" className="mt-3 grid gap-2 sm:grid-cols-2">
            {AGENDA_IDS.map((id) => {
              const chosen = id === tab;
              const entry = draft.agendas[id];
              const times = Object.values(entry.grid).flat().length;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={chosen}
                  onClick={() => setTab(id)}
                  className={`rounded-lg border px-3.5 py-3 text-left transition-colors ${
                    chosen
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background text-foreground hover:bg-muted/50"
                  }`}
                >
                  <span className="block text-sm font-semibold">
                    {AGENDA_NAMES[id].name}
                  </span>
                  <span
                    className={`block text-xs ${chosen ? "text-primary-foreground/80" : "text-muted-foreground"}`}
                  >
                    {times === 0
                      ? "Sem horários: não aparece no site"
                      : `${times} ${times === 1 ? "horário" : "horários"} por semana · ${entry.serviceIds.length} ${entry.serviceIds.length === 1 ? "serviço" : "serviços"}`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <SuggestCard
          key={`suggest-${tab}-${book.serviceIds.join(",")}`}
          // No service ticked yet (a new office): the card offers the ones
          // suggested for this agenda, so the button never sits disabled.
          starting={book.serviceIds.length === 0}
          services={
            book.serviceIds.length
              ? tickedServices(book.serviceIds, draft.services)
              : startingServices(tab)
          }
          weekdays={weekdays}
          onApply={(days, suggestion, chosen) => {
            const grid = { ...book.grid };
            const slotServices = { ...book.slotServices };
            const slotCapacity = { ...book.slotCapacity };
            for (const day of days) {
              grid[day] = [...suggestion.times];
              slotServices[day] = { ...suggestion.services };
              slotCapacity[day] = Object.fromEntries(
                Object.entries(suggestion.capacity).filter(([, n]) => n > 1),
              );
            }
            setBook({
              ...book,
              grid,
              slotServices,
              slotCapacity,
              // Starting: the services kept in the card become the agenda's.
              ...(book.serviceIds.length ? {} : { serviceIds: chosen }),
            });
          }}
        />
        <GridSection
          key={`grid-${tab}`}
          title={`Dias e horários · ${AGENDA_NAMES[tab].short}`}
          grid={book.grid}
          slotServices={book.slotServices}
          slotCapacity={book.slotCapacity}
          services={tickedServices(book.serviceIds, draft.services)}
          weekdays={weekdays}
          futureLive={futureLive[tab]}
          onChange={(grid, slotServices, slotCapacity) =>
            setBook({ ...book, grid, slotServices, slotCapacity })
          }
          channels={usesChannels(tab) ? book.channels : undefined}
          onChannelsChange={(channels) => setBook({ ...book, channels })}
        />
        <ServicePicker
          key={`services-${tab}`}
          agenda={tab}
          selected={book.serviceIds}
          otherSelected={draft.agendas[other].serviceIds}
          own={draft.services}
          lists={lists}
          onChange={(serviceIds) =>
            setBook({
              ...book,
              serviceIds,
              // A time narrowed to a service the agenda no longer takes
              // lets it go; left with none, it takes every service again.
              slotServices: pruneSlotServices({
                grid: book.grid,
                serviceIds,
                slotServices: book.slotServices,
              }) as SlotServicesDraft,
            })
          }
        />
        <OwnServicesSection
          services={draft.services}
          lists={lists}
          onChange={(services, added) =>
            setDraft({
              ...draft,
              services,
              // A service the office just created goes straight into the
              // agenda on screen: creating it is wanting to offer it.
              agendas: added
                ? {
                    ...draft.agendas,
                    [tab]: {
                      ...book,
                      serviceIds: [...book.serviceIds, added],
                    },
                  }
                : draft.agendas,
            })
          }
        />
        <ModesSection
          modes={draft.modes}
          onChange={(modes) => setDraft({ ...draft, modes })}
        />

        <section
          className={`${cardClass} flex items-center justify-between gap-3`}
        >
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Fechar um dia específico (feriado, ausência)
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Isso se faz na própria agenda, abrindo a data; aqui só o que vale
              para todas as semanas.
            </p>
          </div>
          <Link
            href="/admin/agenda"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "shrink-0",
            )}
          >
            Ir para a agenda
          </Link>
        </section>

        {state.status === "error" && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive-soft px-3.5 py-2.5 text-sm font-medium text-destructive"
          >
            {state.message}
          </p>
        )}

        {(dirty || pending) && (
          <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-xl bg-primary px-5 py-3 text-primary-foreground shadow-lg">
            <p className="flex items-center gap-2.5 text-sm">
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full bg-warning-soft"
              />
              Alterações não salvas{summarize(baseline, draft)}
            </p>
            <span className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDraft(baseline)}
                className="text-primary-foreground/85 hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                Descartar
              </Button>
              <Button
                type="submit"
                variant="outline"
                disabled={pending}
                className="border-transparent bg-background text-primary hover:bg-background/90 hover:text-primary"
              >
                {pending ? "Salvando..." : "Salvar agendas"}
              </Button>
            </span>
          </div>
        )}
      </div>

      <Preview
        agenda={tab}
        grid={book.grid}
        serviceLabels={serviceLabels(book.serviceIds, draft.services)}
        modes={draft.modes}
        channels={usesChannels(tab) ? book.channels : undefined}
        closedDates={closedDates}
        takenByDate={takenByDate}
        today={today}
        holidays={holidays}
      />
    </form>
  );
}

/** The ticked services, in the catalogue's order, own ones last. */
function tickedServices(
  ids: string[],
  own: OwnServiceDraft[],
): Array<{ id: string; label: string }> {
  const ticked = new Set(ids);
  return [
    ...COUNTER_SERVICES.filter((service) => ticked.has(service.id)),
    ...own.filter((service) => ticked.has(service.id)),
  ].map(({ id, label }) => ({ id, label }));
}

/**
 * What a new agenda is offered in "Sugerir horários": the catalogue's
 * suggestion for it, or the whole catalogue when it suggests none.
 */
function startingServices(
  agenda: "geral" | "tabeliao",
): Array<{ id: string; label: string }> {
  const suggested = suggestedServiceIds(agenda);
  return tickedServices(
    suggested.length ? suggested : COUNTER_SERVICES.map((s) => s.id),
    [],
  );
}

/** The labels of the ticked services, in the catalogue's order. */
function serviceLabels(ids: string[], own: OwnServiceDraft[]): string[] {
  return tickedServices(ids, own).map((service) => service.label);
}

/** Citizens a day takes: one per time, or the time's vacancies. */
function dayCitizens(
  times: string[],
  capacity: Record<string, number> | undefined,
): number {
  return times.reduce((sum, time) => sum + (capacity?.[time] ?? 1), 0);
}

/* ---------------------------------------------------------------- weekdays */

function GridSection({
  title,
  grid,
  slotServices,
  slotCapacity,
  services,
  weekdays,
  futureLive,
  onChange,
  channels,
  onChannelsChange,
}: {
  title: string;
  grid: Grid;
  /** Per weekday and time, the services the office narrowed it to. */
  slotServices: SlotServicesDraft;
  /** Per weekday and time, how many citizens it takes at once. */
  slotCapacity: SlotCapacityDraft;
  /** The services this agenda takes, the ones a time can be narrowed to. */
  services: Array<{ id: string; label: string }>;
  weekdays: Array<{ day: string; label: string }>;
  futureLive: Record<string, number>;
  onChange: (
    grid: Grid,
    slotServices: SlotServicesDraft,
    slotCapacity: SlotCapacityDraft,
  ) => void;
  /** Present for the notary's agenda: how he attends each weekday. */
  channels?: Record<string, AttendanceChannel[]>;
  onChannelsChange?: (channels: Record<string, AttendanceChannel[]>) => void;
}) {
  function toggleChannel(day: string, channel: AttendanceChannel) {
    if (!channels || !onChannelsChange) return;
    const current = channels[day] ?? DEFAULT_CHANNELS;
    const next = current.includes(channel)
      ? current.filter((item) => item !== channel)
      : [...current, channel];
    // A day always attends somehow: the last channel cannot be unticked.
    if (next.length === 0) return;
    onChannelsChange({
      ...channels,
      [day]: ATTENDANCE_CHANNELS.filter((item) => next.includes(item)),
    });
  }

  const [adding, setAdding] = useState<string | null>(null);
  /** The time whose services are open for editing, as `${day}|${time}`. */
  const [editing, setEditing] = useState<string | null>(null);
  const labelOf = new Map(
    services.map((service) => [service.id, service.label]),
  );

  function addTime(day: string, time: string) {
    if (!time) return;
    onChange(
      { ...grid, [day]: [...new Set([...(grid[day] ?? []), time])].sort() },
      slotServices,
      slotCapacity,
    );
    setAdding(null);
  }

  function removeTime(day: string, time: string) {
    const behind = futureLive[`${day}|${time}`] ?? 0;
    if (
      behind > 0 &&
      !window.confirm(
        `Este horário tem ${behind} ${behind === 1 ? "agendamento futuro" : "agendamentos futuros"}. ` +
          "Eles continuam valendo e aparecem na agenda; o horário só deixa de " +
          "ser oferecido para novas datas. Remover mesmo assim?",
      )
    ) {
      return;
    }
    const { [time]: _gone, ...rest } = slotServices[day] ?? {};
    const { [time]: _seats, ...restCapacity } = slotCapacity[day] ?? {};
    onChange(
      { ...grid, [day]: (grid[day] ?? []).filter((t) => t !== time) },
      { ...slotServices, [day]: rest },
      { ...slotCapacity, [day]: restCapacity },
    );
    if (editing === `${day}|${time}`) setEditing(null);
  }

  /** Copies a day's times, what each one takes and its vacancies, onto
   * another day. */
  function copyDay(from: string, to: string) {
    onChange(
      { ...grid, [to]: [...(grid[from] ?? [])] },
      { ...slotServices, [to]: { ...(slotServices[from] ?? {}) } },
      { ...slotCapacity, [to]: { ...(slotCapacity[from] ?? {}) } },
    );
  }

  function setCapacityAt(day: string, time: string, count: number) {
    const byTime = { ...(slotCapacity[day] ?? {}) };
    if (!Number.isFinite(count) || count <= 1) delete byTime[time];
    else byTime[time] = Math.min(99, Math.floor(count));
    onChange(grid, slotServices, { ...slotCapacity, [day]: byTime });
  }

  function setServicesAt(day: string, time: string, ids: string[]) {
    const byTime = { ...(slotServices[day] ?? {}) };
    // None ticked, or all of them, is "every service": no narrowing kept.
    if (ids.length === 0 || ids.length === services.length) {
      delete byTime[time];
    } else {
      byTime[time] = ids;
    }
    onChange(grid, { ...slotServices, [day]: byTime }, slotCapacity);
  }

  return (
    <section className={cardClass}>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Cada horário atende <strong>um cidadão</strong>. Um dia sem horários não
        aparece no site. Clique num horário para escolher os serviços que ele
        atende (por exemplo, 08:30 só para reconhecimento de firma); sem
        escolha, ele atende todos os serviços desta agenda.
      </p>

      <div className="mt-4 flex flex-col">
        {weekdays.map(({ day, label }) => {
          const times = grid[day] ?? [];
          const source =
            times.length === 0
              ? previousDayWithTimes(grid, Number(day))
              : undefined;
          const sourceLabel = source
            ? weekdays.find((item) => item.day === String(source))?.label
            : undefined;
          const editingTime = editing?.startsWith(`${day}|`)
            ? editing.slice(day.length + 1)
            : undefined;
          return (
            <div
              key={day}
              className="grid grid-cols-[92px_1fr_auto] items-center gap-3 border-b py-2.5 last:border-b-0"
            >
              <span className="text-sm font-medium text-foreground">
                {label}
              </span>
              <span className="flex flex-wrap items-center gap-2">
                {times.map((time) => {
                  const only = slotServices[day]?.[time];
                  const seats = slotCapacity[day]?.[time] ?? 1;
                  const open = editingTime === time;
                  return (
                    <span
                      key={time}
                      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium tabular-nums ${
                        open
                          ? "bg-primary text-primary-foreground"
                          : only
                            ? "border border-primary bg-muted text-foreground"
                            : "bg-muted text-foreground"
                      }`}
                    >
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-label={`Serviços de ${label.toLowerCase()} às ${time}`}
                        onClick={() =>
                          setEditing(open ? null : `${day}|${time}`)
                        }
                        className="inline-flex items-center gap-1.5"
                      >
                        {time}
                        {seats > 1 && (
                          <span className="rounded-sm bg-background px-1 text-xs font-semibold text-primary">
                            ×{seats}
                          </span>
                        )}
                        {only && (
                          <span className="max-w-[140px] truncate text-xs font-normal">
                            ·{" "}
                            {only.length === 1
                              ? (labelOf.get(only[0]) ?? "1 serviço")
                              : `${only.length} serviços`}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        aria-label={`Remover ${time} de ${label.toLowerCase()}`}
                        onClick={() => removeTime(day, time)}
                        className={
                          open
                            ? "text-primary-foreground/70 hover:text-primary-foreground"
                            : "text-muted-foreground hover:text-destructive"
                        }
                      >
                        <AdminIcon name="x" className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
                {adding === day ? (
                  <Input
                    type="time"
                    className={cn(inputClass, "h-8 w-auto")}
                    onBlur={(event) => addTime(day, event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addTime(day, event.currentTarget.value);
                      }
                      if (event.key === "Escape") setAdding(null);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setAdding(day)}
                    className="rounded-md border border-dashed border-input px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  >
                    + horário
                  </button>
                )}
                {source && sourceLabel && (
                  // The day before already has its times: they are suggested
                  // here, so a week is set up once, not five times.
                  <span className="flex basis-full flex-wrap items-center gap-1.5 rounded-lg border border-dashed border-primary/50 px-2.5 py-2">
                    <span className="text-xs text-muted-foreground">
                      Sugestão, os mesmos de {sourceLabel.toLowerCase()}:
                    </span>
                    {(grid[String(source)] ?? []).map((time) => (
                      <span
                        key={time}
                        className="rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground"
                      >
                        {time}
                      </span>
                    ))}
                    <Button
                      type="button"
                      size="xs"
                      onClick={() => copyDay(String(source), day)}
                      className="ml-auto"
                    >
                      Usar os mesmos de {sourceLabel.toLowerCase()}
                    </Button>
                  </span>
                )}
                {editingTime && (
                  <SlotServicesEditor
                    dayLabel={label}
                    time={editingTime}
                    services={services}
                    selected={slotServices[day]?.[editingTime] ?? []}
                    onChange={(ids) => setServicesAt(day, editingTime, ids)}
                    capacity={slotCapacity[day]?.[editingTime] ?? 1}
                    onCapacity={(count) =>
                      setCapacityAt(day, editingTime, count)
                    }
                    onClose={() => setEditing(null)}
                  />
                )}
                {channels && times.length > 0 && (
                  <span className="flex basis-full flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-xs text-muted-foreground">
                      Atende:
                    </span>
                    {ATTENDANCE_CHANNELS.map((channel) => {
                      const on = (channels[day] ?? DEFAULT_CHANNELS).includes(
                        channel,
                      );
                      return (
                        <button
                          key={channel}
                          type="button"
                          aria-pressed={on}
                          aria-label={`${label}: ${CHANNEL_NAMES[channel].label}`}
                          onClick={() => toggleChannel(day, channel)}
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                            on
                              ? "border-primary bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          }`}
                        >
                          {CHANNEL_NAMES[channel].label}
                        </button>
                      );
                    })}
                  </span>
                )}
              </span>
              <span
                className={`justify-self-end text-xs ${
                  times.length === 0
                    ? "font-semibold text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                {times.length === 0
                  ? "Não aparece no site"
                  : `${dayCitizens(times, slotCapacity[day])} ${dayCitizens(times, slotCapacity[day]) === 1 ? "cidadão" : "cidadãos"}/dia`}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Remover um horário nunca apaga agendamentos já feitos: eles continuam na
        agenda, e só as novas datas deixam de oferecer o horário.
        {channels &&
          " Os canais de cada dia valem para todas as semanas; para mudar uma data só, abra o dia na agenda."}
      </p>
    </section>
  );
}

/**
 * The services one time takes, ticked from the agenda's own. Nothing ticked
 * means every service, which is how a time starts; ticking narrows it, and
 * the site then offers that time only to whoever picks one of these.
 */
function SlotServicesEditor({
  dayLabel,
  time,
  services,
  selected,
  onChange,
  capacity,
  onCapacity,
  onClose,
}: {
  dayLabel: string;
  time: string;
  services: Array<{ id: string; label: string }>;
  selected: string[];
  onChange: (ids: string[]) => void;
  /** How many citizens the time takes at once: one per attendant. */
  capacity: number;
  onCapacity: (count: number) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState("");
  const capacityId = useId();
  const visible = services.filter((service) =>
    normalize(service.label).includes(normalize(filter)),
  );
  const all = selected.length === 0;

  function toggle(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter((item) => item !== id)
        : [...selected, id],
    );
  }

  return (
    <span className="flex basis-full flex-col gap-2 rounded-lg border border-primary bg-background px-3 py-2.5">
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">
          {dayLabel}, {time}: o que este horário atende
        </span>
        <label
          htmlFor={capacityId}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          Vagas
          <Input
            id={capacityId}
            type="number"
            min={1}
            max={99}
            value={capacity}
            onChange={(event) => onCapacity(Number(event.target.value))}
            aria-label={`Vagas às ${time}: quantas pessoas atendem ao mesmo tempo`}
            className={cn(inputClass, "h-8 w-16 text-center tabular-nums")}
          />
          <span className="text-xs">pessoas atendendo ao mesmo tempo</span>
        </label>
        <span className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={all}
            onClick={() => onChange([])}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              all
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            Todos os serviços
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-primary underline"
          >
            Pronto
          </button>
        </span>
      </span>
      {services.length === 0 ? (
        <span className="text-xs text-muted-foreground">
          Marque os serviços desta agenda (mais abaixo) para escolher quais este
          horário atende.
        </span>
      ) : (
        <>
          {services.length > 8 && (
            <Input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Procurar serviço, ex.: firma"
              aria-label="Procurar serviço"
              className={cn(inputClass, "h-8")}
            />
          )}
          <span className="grid max-h-56 gap-1 overflow-y-auto sm:grid-cols-2">
            {visible.map((service) => (
              <label
                key={service.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs text-foreground hover:bg-muted/50"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(service.id)}
                  onChange={() => toggle(service.id)}
                  className="checkbox-admin"
                />
                {service.label}
              </label>
            ))}
          </span>
          <span className="text-xs text-muted-foreground">
            {all
              ? "Sem escolha, este horário atende todos os serviços desta agenda."
              : `Este horário atende só ${selected.length === 1 ? "o serviço marcado" : `os ${selected.length} serviços marcados`}.`}
          </span>
        </>
      )}
    </span>
  );
}

/* ---------------------------------------------------------------- services */

/**
 * Every service of a cartório de ofício único, grouped as the catalogue
 * groups them, to tick for this agenda. The list is the platform's, with
 * what each one asks the citizen to bring; the office only chooses.
 */
function ServicePicker({
  agenda,
  selected,
  otherSelected,
  own,
  lists,
  onChange,
}: {
  agenda: AgendaId;
  selected: string[];
  otherSelected: string[];
  own: OwnServiceDraft[];
  lists: Record<string, ListSummary>;
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const ticked = new Set(selected);
  const elsewhere = new Set(otherSelected);
  const otherName =
    AGENDA_NAMES[agenda === "geral" ? "tabeliao" : "geral"].short;
  const needle = normalize(query);

  const groups = [
    ...counterServicesByGroup().map(({ group, services }) => ({
      group,
      services: services.map((service) => ({
        id: service.id,
        label: service.label,
        bring: service.bring,
      })),
    })),
    ...(own.length > 0
      ? [{ group: "Outros serviços da serventia", services: own }]
      : []),
  ]
    .map((entry) => ({
      ...entry,
      services: entry.services.filter(
        (service) =>
          !needle ||
          normalize(service.label).includes(needle) ||
          normalize(entry.group).includes(needle),
      ),
    }))
    .filter((entry) => entry.services.length > 0);

  function toggle(id: string) {
    onChange(
      ticked.has(id)
        ? selected.filter((item) => item !== id)
        : [...selected, id],
    );
  }

  function setGroup(ids: string[], on: boolean) {
    const rest = selected.filter((item) => !ids.includes(item));
    onChange(on ? [...rest, ...ids] : rest);
  }

  return (
    <section className={cardClass}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">
          Serviços que esta agenda atende
        </h2>
        <span className="text-xs text-muted-foreground">
          {selected.length} marcados
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Todos os serviços de um cartório de ofício único. Marque os que o
        cidadão pode agendar em{" "}
        <strong>{AGENDA_NAMES[agenda].name.toLowerCase()}</strong>. Cada um já
        traz a lista do que levar, que vai no comprovante.
      </p>
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Procurar serviço..."
        aria-label="Procurar serviço"
        className={cn(inputClass, "mt-3 w-full")}
      />

      <div className="mt-2 flex flex-col">
        {groups.map(({ group, services }) => {
          const ids = services.map((service) => service.id);
          const all = ids.every((id) => ticked.has(id));
          return (
            <div key={group} className="border-b py-2.5 last:border-b-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-medium text-muted-foreground">
                  {group}
                </h3>
                <button
                  type="button"
                  onClick={() => setGroup(ids, !all)}
                  className="text-xs font-medium text-primary underline"
                >
                  {all ? "Desmarcar todos" : "Marcar todos"}
                </button>
              </div>
              <ul className="mt-1.5 grid gap-1 sm:grid-cols-2">
                {services.map((service) => {
                  const checked = ticked.has(service.id);
                  const expanded = open === service.id;
                  return (
                    <li key={service.id} className="min-w-0">
                      <span className="flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-muted/50">
                        <input
                          id={`svc-${agenda}-${service.id}`}
                          type="checkbox"
                          className="checkbox-admin mt-0.5"
                          checked={checked}
                          onChange={() => toggle(service.id)}
                        />
                        <span className="min-w-0 flex-1">
                          <label
                            htmlFor={`svc-${agenda}-${service.id}`}
                            className="block cursor-pointer text-sm text-foreground"
                          >
                            {service.label}
                          </label>
                          <span className="flex flex-wrap items-center gap-x-2 text-xs">
                            {elsewhere.has(service.id) && (
                              <span className="text-muted-foreground">
                                também na agenda {otherName}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setOpen(expanded ? null : service.id)
                              }
                              aria-expanded={expanded}
                              className="font-medium text-muted-foreground underline hover:text-foreground"
                            >
                              {expanded ? "Fechar" : "O que levar"}
                            </button>
                            {lists[service.id]?.edited && (
                              <span className="font-medium text-primary">
                                lista do cartório
                              </span>
                            )}
                            {lists[service.id]?.hasFile && (
                              <span className="font-medium text-primary">
                                com arquivo
                              </span>
                            )}
                          </span>
                          {expanded && (
                            <>
                              <ul className="mt-1 list-disc pl-4 text-xs leading-relaxed text-muted-foreground">
                                {(
                                  lists[service.id]?.items ?? [
                                    ...BASE_CHECKLIST,
                                    ...service.bring,
                                  ]
                                ).map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                              {lists[service.id] ? (
                                <Link
                                  href={listHref(service.id)}
                                  className="mt-1 inline-block text-xs font-medium text-primary underline"
                                >
                                  Editar a lista ou anexar a do cartório
                                </Link>
                              ) : (
                                <span className="mt-1 block text-xs text-muted-foreground">
                                  Salve as agendas para editar a lista deste
                                  serviço.
                                </span>
                              )}
                            </>
                          )}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {groups.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Nenhum serviço com esse nome.
          </p>
        )}
      </div>
    </section>
  );
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Services the catalogue does not have, created by the office, each with its
 * own list of what to bring. Ticked in each agenda like any other.
 */
function OwnServicesSection({
  services,
  lists,
  onChange,
}: {
  services: OwnServiceDraft[];
  lists: Record<string, ListSummary>;
  onChange: (services: OwnServiceDraft[], added?: string) => void;
}) {
  const [label, setLabel] = useState("");

  function add() {
    const name = label.trim();
    if (!name) return;
    if (services.some((service) => service.label === name)) {
      setLabel("");
      return;
    }
    const used = new Set(services.map((service) => service.id));
    const id = ownServiceId(name, used);
    onChange([...services, { id, label: name, bring: [] }], id);
    setLabel("");
  }

  return (
    <section className={cardClass}>
      <h2 className="text-base font-semibold text-foreground">
        Serviços próprios da serventia
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Para o que não está na lista acima. Depois de salvar, escreva o que o
        cidadão precisa levar ou anexe a lista do cartório.
      </p>
      <div className="mt-2 flex flex-col">
        {services.map((service, index) => (
          <div key={service.id} className="border-b py-2.5 last:border-b-0">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-medium text-foreground">
                {service.label}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Remover ${service.label}`}
                onClick={() => onChange(services.filter((_, i) => i !== index))}
                className="text-muted-foreground hover:text-destructive"
              >
                <AdminIcon name="x" className="h-3.5 w-3.5" />
              </Button>
            </div>
            {lists[service.id] ? (
              <Link
                href={listHref(service.id)}
                className="mt-1 inline-block text-xs font-medium text-primary underline"
              >
                Editar o que levar ({lists[service.id].items.length}{" "}
                {lists[service.id].items.length === 1 ? "item" : "itens"}
                {lists[service.id].hasFile ? " e arquivo" : ""})
              </Link>
            ) : (
              <span className="mt-1 block text-xs text-muted-foreground">
                Salve as agendas para escrever o que levar.
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder="Nome do novo serviço..."
          className={cn(inputClass, "flex-1")}
        />
        <Button type="button" variant="outline" onClick={add}>
          Adicionar
        </Button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- modes */

function ModesSection({
  modes,
  onChange,
}: {
  modes: string[];
  onChange: (modes: string[]) => void;
}) {
  const cards = [
    ...KNOWN_MODES,
    ...modes
      .filter((mode) => !KNOWN_MODES.some((known) => known.label === mode))
      .map((mode) => ({ label: mode, description: "" })),
  ];

  return (
    <section className={cardClass}>
      <h2 className="text-base font-semibold text-foreground">
        Modos de atendimento do cartório
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Valem para a agenda do cartório. O tabelião escolhe os canais dele
        (presencial, vídeo ou ligação) em cada dia, na aba dele.
      </p>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {cards.map(({ label, description }) => {
          const checked = modes.includes(label);
          return (
            <label
              key={label}
              className={`relative flex cursor-pointer items-start gap-2.5 rounded-lg border px-3.5 py-3 text-left transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50 ${
                checked ? "border-primary bg-muted/50" : "hover:bg-muted/50"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  onChange(
                    checked
                      ? modes.filter((mode) => mode !== label)
                      : [...modes, label],
                  )
                }
                className="sr-only"
              />
              <span
                className={`mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-sm ${
                  checked
                    ? "bg-primary text-primary-foreground"
                    : "border border-input bg-background"
                }`}
              >
                {checked && <AdminIcon name="check" className="h-3 w-3" />}
              </span>
              <span>
                <span className="block text-sm font-semibold text-foreground">
                  {label}
                </span>
                {description && (
                  <span className="block text-xs leading-snug text-muted-foreground">
                    {description}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- preview */

/**
 * What /agendar will show for the agenda on screen once this is saved,
 * computed from the unsaved state, which is the whole point: the office sees
 * the consequence before committing to it.
 */
function Preview({
  agenda,
  grid,
  serviceLabels,
  modes: officeModes,
  channels,
  closedDates,
  takenByDate,
  today,
  holidays,
}: {
  agenda: AgendaId;
  grid: Grid;
  serviceLabels: string[];
  modes: string[];
  /** The notary's channels per weekday: the preview shows the day's. */
  channels?: Record<string, AttendanceChannel[]>;
  closedDates: string[];
  takenByDate: Record<string, string[]>;
  today: string;
  holidays: OfficeHolidays;
}) {
  const days = previewDays(grid, closedDates, today, holidays);
  const [picked, setPicked] = useState(0);
  const selected = days[Math.min(picked, Math.max(days.length - 1, 0))];
  const times = selected ? (grid[String(weekday(selected))] ?? []) : [];
  const taken = new Set(selected ? (takenByDate[selected] ?? []) : []);
  const modes =
    channels && selected
      ? (channels[String(weekday(selected))] ?? DEFAULT_CHANNELS).map(
          (channel) => CHANNEL_NAMES[channel].label,
        )
      : officeModes;

  return (
    <aside className="rounded-xl border bg-card px-5 py-4 lg:sticky lg:top-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">
          Como o cidadão vê
        </h2>
        <Badge className="border-warning/30 bg-warning-soft text-warning-text">
          prévia ao vivo
        </Badge>
      </div>
      <p className="mt-1 text-xs font-medium text-muted-foreground">
        {AGENDA_NAMES[agenda].name}
      </p>

      <div className="mt-3 rounded-lg bg-muted/50 p-4">
        {days.length === 0 ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Sem nenhum horário, esta agenda não aparece no site.
          </p>
        ) : (
          <>
            <p className="text-xs font-semibold text-foreground">
              Escolha o dia
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {days.map((date, index) => (
                <button
                  key={date}
                  type="button"
                  onClick={() => setPicked(index)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${
                    date === selected
                      ? "bg-primary text-primary-foreground"
                      : "border bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  {previewDayLabel(date)}
                </button>
              ))}
            </div>

            <p className="mt-3 text-xs font-semibold text-foreground">
              Horários de {selected ? longWeekday(selected) : ""}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {times.map((time, index) => {
                const isTaken = taken.has(time);
                const highlighted =
                  !isTaken && index === times.findIndex((t) => !taken.has(t));
                return (
                  <span
                    key={time}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium tabular-nums ${
                      isTaken
                        ? "border bg-muted text-muted-foreground line-through"
                        : highlighted
                          ? "bg-primary text-primary-foreground"
                          : "border bg-card text-foreground"
                    }`}
                  >
                    {time}
                  </span>
                );
              })}
            </div>

            <p className="mt-3 text-xs font-semibold text-foreground">
              Serviços ({serviceLabels.length})
            </p>
            {serviceLabels.length === 0 ? (
              <p className="mt-1.5 text-xs font-medium text-destructive">
                Nenhum serviço marcado: marque ao menos um.
              </p>
            ) : (
              <ul className="mt-1.5 flex flex-col gap-1 text-xs text-foreground">
                {serviceLabels.slice(0, 5).map((label) => (
                  <li
                    key={label}
                    className="rounded-md border bg-card px-3 py-1.5"
                  >
                    {label}
                  </li>
                ))}
                {serviceLabels.length > 5 && (
                  <li className="text-xs text-muted-foreground">
                    e mais {serviceLabels.length - 5}
                  </li>
                )}
              </ul>
            )}

            {modes.length > 0 && (
              <>
                <p className="mt-3 text-xs font-semibold text-foreground">
                  {channels ? "Como o tabelião atende" : "Modo"}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-3">
                  {modes.map((mode, index) => (
                    <span
                      key={mode}
                      className="flex items-center gap-1.5 text-xs text-foreground"
                    >
                      <span
                        className={`h-3.5 w-3.5 rounded-full ${
                          index === 0
                            ? "border-4 border-primary"
                            : "border border-input bg-card"
                        }`}
                      />
                      {mode}
                    </span>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        A prévia usa os dados desta tela. Horários já ocupados aparecem
        riscados. Ao final, o cidadão recebe o comprovante em PDF com a lista do
        que levar e o aviso de chegar 15 minutos antes.
      </p>
    </aside>
  );
}

/** The next three dates the unsaved grid would offer, skipping weekends,
 * holidays and dates the office closed. */
function previewDays(
  grid: Grid,
  closedDates: string[],
  today: string,
  holidays: OfficeHolidays,
): string[] {
  const days: string[] = [];
  const closed = new Set(closedDates);
  const cursor = new Date(`${today}T00:00:00Z`);
  for (let step = 0; step < 28 && days.length < 3; step++) {
    const date = cursor.toISOString().slice(0, 10);
    if (
      isBusinessDay(date, holidays) &&
      !closed.has(date) &&
      (grid[String(weekday(date))] ?? []).length > 0
    ) {
      days.push(date);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/** "seg, 24/08", the compact label the public page uses for its day chips. */
function previewDayLabel(date: string): string {
  return `${longWeekday(date).slice(0, 3)}, ${dayOfMonth(date)}/${date.slice(5, 7)}`;
}

/** ": 2 horários novos · 3 serviços marcados", for the unsaved-changes bar. */
function summarize(saved: Draft, current: Draft): string {
  const phrases: string[] = [];
  const flat = (books: Books) =>
    AGENDA_IDS.flatMap((id) =>
      Object.entries(books[id].grid).flatMap(([day, times]) =>
        times.map((time) => `${id}|${day}|${time}`),
      ),
    );
  const ticks = (books: Books) =>
    AGENDA_IDS.flatMap((id) => books[id].serviceIds.map((s) => `${id}|${s}`));
  const diff = (a: string[], b: string[]) => {
    const before = new Set(a);
    const after = new Set(b);
    return [
      [...after].filter((x) => !before.has(x)).length,
      [...before].filter((x) => !after.has(x)).length,
    ];
  };

  const [addedTimes, removedTimes] = diff(
    flat(saved.agendas),
    flat(current.agendas),
  );
  if (addedTimes > 0) {
    phrases.push(
      `${addedTimes} ${addedTimes === 1 ? "horário novo" : "horários novos"}`,
    );
  }
  if (removedTimes > 0) {
    phrases.push(
      `${removedTimes} ${removedTimes === 1 ? "horário removido" : "horários removidos"}`,
    );
  }
  const [ticked, unticked] = diff(ticks(saved.agendas), ticks(current.agendas));
  if (ticked > 0) {
    phrases.push(
      `${ticked} ${ticked === 1 ? "serviço marcado" : "serviços marcados"}`,
    );
  }
  if (unticked > 0) {
    phrases.push(
      `${unticked} ${unticked === 1 ? "serviço desmarcado" : "serviços desmarcados"}`,
    );
  }
  if (
    JSON.stringify(saved.services) !== JSON.stringify(current.services) &&
    phrases.length < 2
  ) {
    phrases.push("serviços próprios alterados");
  }
  if (
    JSON.stringify([...saved.modes].sort()) !==
    JSON.stringify([...current.modes].sort())
  ) {
    phrases.push("modos alterados");
  }

  return phrases.length > 0 ? `: ${phrases.slice(0, 2).join(" · ")}` : "";
}
