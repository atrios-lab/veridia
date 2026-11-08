"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
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
} from "@/core/scheduling/services.ts";
import { AdminIcon } from "../../../_components/icon.tsx";
import { type ActionState, saveAgenda } from "../actions.ts";

type Grid = Record<string, string[]>;

interface BookDraft {
  grid: Grid;
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

const cardClass =
  "rounded-[14px] border border-admin-border bg-admin-card px-5 py-4";
const inputClass =
  "rounded-lg border border-admin-border bg-admin-input-bg px-3 py-2 text-[13px] text-admin-text outline-none focus:border-admin-accent";

/**
 * Both agendas as structured state: chips for times, ticks for services,
 * cards for modes, and a live preview computed from what is on the screen,
 * not from what was last saved. One JSON field carries it all to the action,
 * where the core's schemas remain the referee.
 */
export function AgendaSettingsForm({
  initial,
  weekdays,
  closedDates,
  takenByDate,
  futureLive,
  today,
  holidays,
}: {
  initial: Draft;
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
      className="grid items-start gap-4.5 lg:grid-cols-[1fr_360px]"
    >
      <input type="hidden" name="config" value={JSON.stringify(draft)} />

      <div className="flex flex-col gap-4.5">
        <section className={cardClass}>
          <h2 className="font-serif text-[16px] font-semibold text-admin-primary">
            Agendas
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-admin-muted">
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
                  className={`rounded-xl border px-3.5 py-3 text-left ${
                    chosen
                      ? "border-admin-primary bg-admin-primary text-white"
                      : "border-admin-border bg-admin-card text-admin-text hover:bg-admin-input-bg"
                  }`}
                >
                  <span className="block text-[13.5px] font-bold">
                    {AGENDA_NAMES[id].name}
                  </span>
                  <span
                    className={`block text-[12px] ${chosen ? "text-white/80" : "text-admin-muted"}`}
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

        <GridSection
          key={`grid-${tab}`}
          title={`Dias e horários · ${AGENDA_NAMES[tab].short}`}
          grid={book.grid}
          weekdays={weekdays}
          futureLive={futureLive[tab]}
          onChange={(grid) => setBook({ ...book, grid })}
          channels={usesChannels(tab) ? book.channels : undefined}
          onChannelsChange={(channels) => setBook({ ...book, channels })}
        />
        <ServicePicker
          key={`services-${tab}`}
          agenda={tab}
          selected={book.serviceIds}
          otherSelected={draft.agendas[other].serviceIds}
          own={draft.services}
          onChange={(serviceIds) => setBook({ ...book, serviceIds })}
        />
        <OwnServicesSection
          services={draft.services}
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
            <h2 className="text-[13.5px] font-bold text-admin-primary">
              Fechar um dia específico (feriado, ausência)
            </h2>
            <p className="mt-1 text-[12.5px] text-admin-muted">
              Isso se faz na própria agenda, abrindo a data; aqui só o que vale
              para todas as semanas.
            </p>
          </div>
          <Link
            href="/admin/agenda"
            className="shrink-0 rounded-lg border border-admin-border px-3.5 py-2 text-[12.5px] font-semibold text-admin-muted hover:bg-admin-input-bg"
          >
            Ir para a agenda
          </Link>
        </section>

        {state.status === "error" && (
          <p
            role="alert"
            className="rounded-lg border border-admin-alert px-3.5 py-2.5 text-[13px] font-semibold text-admin-alert"
          >
            {state.message}
          </p>
        )}

        {(dirty || pending) && (
          <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-[14px] bg-admin-primary px-5 py-3 text-white shadow-lg">
            <p className="flex items-center gap-2.5 text-[13px]">
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full bg-admin-warning-bg"
              />
              Alterações não salvas{summarize(baseline, draft)}
            </p>
            <span className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setDraft(baseline)}
                className="px-3 py-2 text-[13px] font-semibold text-white/85 hover:text-white"
              >
                Descartar
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-white px-4 py-2 text-[13px] font-semibold text-admin-primary disabled:opacity-60"
              >
                {pending ? "Salvando..." : "Salvar agendas"}
              </button>
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

/** The labels of the ticked services, in the catalogue's order. */
function serviceLabels(ids: string[], own: OwnServiceDraft[]): string[] {
  const ticked = new Set(ids);
  return [
    ...COUNTER_SERVICES.filter((service) => ticked.has(service.id)).map(
      (service) => service.label,
    ),
    ...own.filter((service) => ticked.has(service.id)).map((s) => s.label),
  ];
}

/* ---------------------------------------------------------------- weekdays */

function GridSection({
  title,
  grid,
  weekdays,
  futureLive,
  onChange,
  channels,
  onChannelsChange,
}: {
  title: string;
  grid: Grid;
  weekdays: Array<{ day: string; label: string }>;
  futureLive: Record<string, number>;
  onChange: (grid: Grid) => void;
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
  const monday = grid["1"] ?? [];

  function addTime(day: string, time: string) {
    if (!time) return;
    onChange({
      ...grid,
      [day]: [...new Set([...(grid[day] ?? []), time])].sort(),
    });
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
    onChange({ ...grid, [day]: (grid[day] ?? []).filter((t) => t !== time) });
  }

  return (
    <section className={cardClass}>
      <h2 className="font-serif text-[16px] font-semibold text-admin-primary">
        {title}
      </h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-admin-muted">
        Cada horário atende <strong>um cidadão</strong>. Um dia sem horários não
        aparece no site.
      </p>

      <div className="mt-3.5 flex flex-col">
        {weekdays.map(({ day, label }) => {
          const times = grid[day] ?? [];
          return (
            <div
              key={day}
              className="grid grid-cols-[92px_1fr_auto] items-center gap-3 border-b border-admin-border py-2.5 last:border-b-0"
            >
              <span className="text-[13px] font-semibold text-admin-text">
                {label}
              </span>
              <span className="flex flex-wrap items-center gap-2">
                {times.map((time) => (
                  <span
                    key={time}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-admin-input-bg px-2.5 py-1.5 text-[12.5px] font-semibold tabular-nums text-admin-text"
                  >
                    {time}
                    <button
                      type="button"
                      aria-label={`Remover ${time} de ${label.toLowerCase()}`}
                      onClick={() => removeTime(day, time)}
                      className="text-admin-faint hover:text-admin-alert"
                    >
                      <AdminIcon name="x" className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {adding === day ? (
                  <input
                    type="time"
                    className={`${inputClass} py-1`}
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
                    className="rounded-lg border border-dashed border-admin-border px-2.5 py-1.5 text-[12.5px] font-semibold text-admin-muted hover:bg-admin-input-bg"
                  >
                    + horário
                  </button>
                )}
                {times.length === 0 && day !== "1" && monday.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onChange({ ...grid, [day]: [...monday] })}
                    className="text-[12.5px] font-semibold text-admin-accent underline"
                  >
                    Copiar de segunda
                  </button>
                )}
                {channels && times.length > 0 && (
                  <span className="flex basis-full flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11.5px] text-admin-faint">
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
                          className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${
                            on
                              ? "border-admin-primary bg-admin-primary text-white"
                              : "border-admin-border text-admin-muted hover:bg-admin-input-bg"
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
                className={`justify-self-end text-[12px] ${
                  times.length === 0
                    ? "font-semibold text-admin-alert"
                    : "text-admin-muted"
                }`}
              >
                {times.length === 0
                  ? "Não aparece no site"
                  : `${times.length} ${times.length === 1 ? "cidadão" : "cidadãos"}/dia`}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11.5px] leading-relaxed text-admin-faint">
        Remover um horário nunca apaga agendamentos já feitos: eles continuam na
        agenda, e só as novas datas deixam de oferecer o horário.
        {channels &&
          " Os canais de cada dia valem para todas as semanas; para mudar uma data só, abra o dia na agenda."}
      </p>
    </section>
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
  onChange,
}: {
  agenda: AgendaId;
  selected: string[];
  otherSelected: string[];
  own: OwnServiceDraft[];
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
        <h2 className="font-serif text-[16px] font-semibold text-admin-primary">
          Serviços que esta agenda atende
        </h2>
        <span className="text-[12px] text-admin-muted">
          {selected.length} marcados
        </span>
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-admin-muted">
        Todos os serviços de um cartório de ofício único. Marque os que o
        cidadão pode agendar em{" "}
        <strong>{AGENDA_NAMES[agenda].name.toLowerCase()}</strong>. Cada um já
        traz a lista do que levar, que vai no comprovante.
      </p>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Procurar serviço..."
        aria-label="Procurar serviço"
        className={`${inputClass} mt-3 w-full`}
      />

      <div className="mt-2 flex flex-col">
        {groups.map(({ group, services }) => {
          const ids = services.map((service) => service.id);
          const all = ids.every((id) => ticked.has(id));
          return (
            <div
              key={group}
              className="border-b border-admin-border py-2.5 last:border-b-0"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[12px] font-bold tracking-[0.06em] text-admin-faint uppercase">
                  {group}
                </h3>
                <button
                  type="button"
                  onClick={() => setGroup(ids, !all)}
                  className="text-[12px] font-semibold text-admin-accent underline"
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
                      <span className="flex items-start gap-2 rounded-lg px-1.5 py-1 hover:bg-admin-input-bg">
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
                            className="block cursor-pointer text-[13px] text-admin-text"
                          >
                            {service.label}
                          </label>
                          <span className="flex flex-wrap items-center gap-x-2 text-[11.5px]">
                            {elsewhere.has(service.id) && (
                              <span className="text-admin-faint">
                                também na agenda {otherName}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setOpen(expanded ? null : service.id)
                              }
                              aria-expanded={expanded}
                              className="font-semibold text-admin-muted underline"
                            >
                              {expanded ? "Fechar" : "O que levar"}
                            </button>
                          </span>
                          {expanded && (
                            <ul className="mt-1 list-disc pl-4 text-[11.5px] leading-relaxed text-admin-muted">
                              {[...BASE_CHECKLIST, ...service.bring].map(
                                (item) => (
                                  <li key={item}>{item}</li>
                                ),
                              )}
                            </ul>
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
          <p className="py-4 text-center text-[12.5px] text-admin-muted">
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
  onChange,
}: {
  services: OwnServiceDraft[];
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
      <h2 className="font-serif text-[16px] font-semibold text-admin-primary">
        Serviços próprios da serventia
      </h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-admin-muted">
        Para o que não está na lista acima. Escreva o que o cidadão precisa
        levar, um item por linha: vai no comprovante, depois do documento com
        foto.
      </p>
      <div className="mt-2 flex flex-col">
        {services.map((service, index) => (
          <div
            key={service.id}
            className="border-b border-admin-border py-2.5 last:border-b-0"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-[13.5px] font-semibold text-admin-text">
                {service.label}
              </span>
              <button
                type="button"
                aria-label={`Remover ${service.label}`}
                onClick={() => onChange(services.filter((_, i) => i !== index))}
                className="text-admin-faint hover:text-admin-alert"
              >
                <AdminIcon name="x" className="h-3.5 w-3.5" />
              </button>
            </div>
            <label className="mt-1.5 block text-[11.5px] font-semibold text-admin-muted">
              O que levar
              <textarea
                rows={2}
                value={service.bring.join("\n")}
                onChange={(event) =>
                  onChange(
                    services.map((item, i) =>
                      i === index
                        ? { ...item, bring: event.target.value.split("\n") }
                        : item,
                    ),
                  )
                }
                placeholder={"Ex.: Guia paga\nDocumento do veículo"}
                className={`${inputClass} mt-1 w-full font-normal`}
              />
            </label>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder="Nome do novo serviço..."
          className={`${inputClass} flex-1`}
        />
        <button
          type="button"
          onClick={add}
          className="rounded-lg border border-admin-border px-3.5 py-2 text-[12.5px] font-semibold text-admin-muted hover:bg-admin-input-bg"
        >
          Adicionar
        </button>
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
      <h2 className="font-serif text-[16px] font-semibold text-admin-primary">
        Modos de atendimento do cartório
      </h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-admin-muted">
        Valem para a agenda do cartório. O tabelião escolhe os canais dele
        (presencial, vídeo ou ligação) em cada dia, na aba dele.
      </p>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {cards.map(({ label, description }) => {
          const checked = modes.includes(label);
          return (
            <label
              key={label}
              className={`relative flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-3 text-left ${
                checked
                  ? "border-admin-primary bg-admin-input-bg"
                  : "border-admin-border"
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
                className={`mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded ${
                  checked
                    ? "bg-admin-primary text-white"
                    : "border border-admin-border"
                }`}
              >
                {checked && <AdminIcon name="check" className="h-3 w-3" />}
              </span>
              <span>
                <span className="block text-[13px] font-bold text-admin-text">
                  {label}
                </span>
                {description && (
                  <span className="block text-[12px] leading-snug text-admin-muted">
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
    <aside className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4 lg:sticky lg:top-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-serif text-[16px] font-semibold text-admin-primary">
          Como o cidadão vê
        </h2>
        <span className="rounded-full bg-admin-warning-bg px-2.5 py-1 text-[11px] font-bold text-admin-warning-text">
          prévia ao vivo
        </span>
      </div>
      <p className="mt-1 text-[12px] font-semibold text-admin-muted">
        {AGENDA_NAMES[agenda].name}
      </p>

      <div className="mt-3 rounded-xl border border-admin-border bg-admin-input-bg/50 p-4">
        {days.length === 0 ? (
          <p className="text-[12.5px] leading-relaxed text-admin-muted">
            Sem nenhum horário, esta agenda não aparece no site.
          </p>
        ) : (
          <>
            <p className="text-[12px] font-bold text-admin-text">
              Escolha o dia
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {days.map((date, index) => (
                <button
                  key={date}
                  type="button"
                  onClick={() => setPicked(index)}
                  className={`rounded-lg px-2.5 py-1.5 text-[12px] font-semibold ${
                    date === selected
                      ? "bg-admin-primary text-white"
                      : "border border-admin-border bg-admin-card text-admin-text"
                  }`}
                >
                  {previewDayLabel(date)}
                </button>
              ))}
            </div>

            <p className="mt-3 text-[12px] font-bold text-admin-text">
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
                    className={`rounded-lg px-2.5 py-1.5 text-[12px] font-semibold tabular-nums ${
                      isTaken
                        ? "border border-admin-border bg-admin-card text-admin-faint line-through"
                        : highlighted
                          ? "bg-admin-primary text-white"
                          : "border border-admin-border bg-admin-card text-admin-text"
                    }`}
                  >
                    {time}
                  </span>
                );
              })}
            </div>

            <p className="mt-3 text-[12px] font-bold text-admin-text">
              Serviços ({serviceLabels.length})
            </p>
            {serviceLabels.length === 0 ? (
              <p className="mt-1.5 text-[12px] font-semibold text-admin-alert">
                Nenhum serviço marcado: marque ao menos um.
              </p>
            ) : (
              <ul className="mt-1.5 flex flex-col gap-1 text-[12.5px] text-admin-text">
                {serviceLabels.slice(0, 5).map((label) => (
                  <li
                    key={label}
                    className="rounded-lg border border-admin-border bg-admin-card px-3 py-1.5"
                  >
                    {label}
                  </li>
                ))}
                {serviceLabels.length > 5 && (
                  <li className="text-[12px] text-admin-muted">
                    e mais {serviceLabels.length - 5}
                  </li>
                )}
              </ul>
            )}

            {modes.length > 0 && (
              <>
                <p className="mt-3 text-[12px] font-bold text-admin-text">
                  {channels ? "Como o tabelião atende" : "Modo"}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-3">
                  {modes.map((mode, index) => (
                    <span
                      key={mode}
                      className="flex items-center gap-1.5 text-[12.5px] text-admin-text"
                    >
                      <span
                        className={`h-3.5 w-3.5 rounded-full ${
                          index === 0
                            ? "border-4 border-admin-primary"
                            : "border border-admin-border bg-admin-card"
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

      <p className="mt-3 text-[11.5px] leading-relaxed text-admin-faint">
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
