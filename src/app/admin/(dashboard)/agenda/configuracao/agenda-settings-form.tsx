"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  dayOfMonth,
  isBusinessDay,
  longWeekday,
  weekday,
} from "@/core/scheduling/calendar.ts";
import { AdminIcon } from "../../../_components/icon.tsx";
import { type ActionState, saveAgenda } from "../actions.ts";

interface ServiceDraft {
  label: string;
  notaryOnly: boolean;
}

type Grid = Record<string, string[]>;

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
 * The whole agenda as structured state: chips for times, toggles for
 * services, cards for modes, and a live preview computed from what is on the
 * screen, not from what was last saved. One JSON field carries it all to the
 * action, where the core's schema remains the referee.
 */
export function AgendaSettingsForm({
  initialGrid,
  weekdays,
  initialServices,
  initialModes,
  closedDates,
  takenByDate,
  futureLive,
  today,
}: {
  initialGrid: Grid;
  weekdays: Array<{ day: string; label: string }>;
  initialServices: ServiceDraft[];
  initialModes: string[];
  closedDates: string[];
  /** date -> times already held, for the preview's strikethroughs. */
  takenByDate: Record<string, string[]>;
  /** `${weekday}|${time}` -> live future appointments on that grid slot. */
  futureLive: Record<string, number>;
  today: string;
}) {
  const [grid, setGrid] = useState<Grid>(initialGrid);
  const [services, setServices] = useState<ServiceDraft[]>(initialServices);
  const [modes, setModes] = useState<string[]>(initialModes);
  const [baseline, setBaseline] = useState({
    grid: initialGrid,
    services: initialServices,
    modes: initialModes,
  });

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
      setBaseline({ grid, services, modes });
    }
  }, [state, grid, services, modes]);

  const dirty =
    JSON.stringify({ grid, services, modes }) !== JSON.stringify(baseline);

  return (
    <form
      action={formAction}
      className="grid items-start gap-4.5 lg:grid-cols-[1fr_360px]"
    >
      <input
        type="hidden"
        name="config"
        value={JSON.stringify({ grid, services, modes })}
      />

      <div className="flex flex-col gap-4.5">
        <GridSection
          grid={grid}
          weekdays={weekdays}
          futureLive={futureLive}
          onChange={setGrid}
        />
        <ServicesSection services={services} onChange={setServices} />
        <ModesSection modes={modes} onChange={setModes} />

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
              Alterações não salvas
              {summarize(baseline, { grid, services, modes })}
            </p>
            <span className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => {
                  setGrid(baseline.grid);
                  setServices(baseline.services);
                  setModes(baseline.modes);
                }}
                className="px-3 py-2 text-[13px] font-semibold text-white/85 hover:text-white"
              >
                Descartar
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-white px-4 py-2 text-[13px] font-semibold text-admin-primary disabled:opacity-60"
              >
                {pending ? "Salvando..." : "Salvar agenda"}
              </button>
            </span>
          </div>
        )}
      </div>

      <Preview
        grid={grid}
        services={services}
        modes={modes}
        closedDates={closedDates}
        takenByDate={takenByDate}
        today={today}
      />
    </form>
  );
}

/* ---------------------------------------------------------------- weekdays */

function GridSection({
  grid,
  weekdays,
  futureLive,
  onChange,
}: {
  grid: Grid;
  weekdays: Array<{ day: string; label: string }>;
  futureLive: Record<string, number>;
  onChange: (grid: Grid) => void;
}) {
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
        Horários por dia da semana
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
      </p>
    </section>
  );
}

/* ---------------------------------------------------------------- services */

function ServicesSection({
  services,
  onChange,
}: {
  services: ServiceDraft[];
  onChange: (services: ServiceDraft[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const label = draft.trim();
    if (!label) return;
    if (!services.some((service) => service.label === label)) {
      onChange([...services, { label, notaryOnly: false }]);
    }
    setDraft("");
  }

  return (
    <section className={cardClass}>
      <h2 className="font-serif text-[16px] font-semibold text-admin-primary">
        Serviços que o cidadão pode escolher
      </h2>
      <div className="mt-2 flex flex-col">
        {services.map((service, index) => (
          <div
            key={service.label}
            className="flex items-center justify-between gap-3 border-b border-admin-border py-2.5"
          >
            <span className="min-w-0 truncate text-[13.5px] text-admin-text">
              {service.label}
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-admin-muted">
                <span className={service.notaryOnly ? "font-semibold" : ""}>
                  Só com o tabelião
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={service.notaryOnly}
                  aria-label={`Só com o tabelião: ${service.label}`}
                  onClick={() =>
                    onChange(
                      services.map((item, i) =>
                        i === index
                          ? { ...item, notaryOnly: !item.notaryOnly }
                          : item,
                      ),
                    )
                  }
                  className={`relative h-5.5 w-10 rounded-full transition-colors ${
                    service.notaryOnly
                      ? "bg-admin-primary"
                      : "bg-admin-readonly-bg"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white transition-all ${
                      service.notaryOnly ? "left-5" : "left-0.5"
                    }`}
                  />
                </button>
              </label>
              <button
                type="button"
                aria-label={`Remover ${service.label}`}
                onClick={() => onChange(services.filter((_, i) => i !== index))}
                className="text-admin-faint hover:text-admin-alert"
              >
                <AdminIcon name="x" className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
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
      <p className="mt-2.5 text-[11.5px] leading-relaxed text-admin-faint">
        "Só com o tabelião" marca o serviço na agenda e na prévia: o cidadão
        fica sabendo antes de escolher o horário.
      </p>
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
        Modos de atendimento
      </h2>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {cards.map(({ label, description }) => {
          const checked = modes.includes(label);
          return (
            <label
              key={label}
              className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-3 text-left ${
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
 * What /agendar will show once this is saved, computed from the unsaved
 * state, which is the whole point: the office sees the consequence before
 * committing to it.
 */
function Preview({
  grid,
  services,
  modes,
  closedDates,
  takenByDate,
  today,
}: {
  grid: Grid;
  services: ServiceDraft[];
  modes: string[];
  closedDates: string[];
  takenByDate: Record<string, string[]>;
  today: string;
}) {
  const days = previewDays(grid, closedDates, today);
  const [picked, setPicked] = useState(0);
  const selected = days[Math.min(picked, Math.max(days.length - 1, 0))];
  const times = selected ? (grid[String(weekday(selected))] ?? []) : [];
  const taken = new Set(selected ? (takenByDate[selected] ?? []) : []);
  const flagged = services.find((service) => service.notaryOnly);
  const shownService = flagged ?? services[0];

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

      <div className="mt-3 rounded-xl border border-admin-border bg-admin-input-bg/50 p-4">
        {days.length === 0 ? (
          <p className="text-[12.5px] leading-relaxed text-admin-muted">
            Sem nenhum horário na grade, o site pede que o cidadão ligue para a
            serventia.
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

            {shownService && (
              <>
                <p className="mt-3 text-[12px] font-bold text-admin-text">
                  Serviço
                </p>
                <p className="mt-1.5 rounded-lg border border-admin-border bg-admin-card px-3 py-2.5 text-[12.5px] text-admin-text">
                  {shownService.label}
                  {shownService.notaryOnly && (
                    <span className="font-semibold text-admin-warning-text">
                      {" "}
                      · só com o tabelião
                    </span>
                  )}
                </p>
              </>
            )}

            {modes.length > 0 && (
              <>
                <p className="mt-3 text-[12px] font-bold text-admin-text">
                  Modo
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
        A prévia usa os dados desta tela: horários já ocupados aparecem
        riscados, e o serviço marcado "só com o tabelião" avisa o cidadão antes
        de ele escolher.
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
): string[] {
  const days: string[] = [];
  const closed = new Set(closedDates);
  const cursor = new Date(`${today}T00:00:00Z`);
  for (let step = 0; step < 28 && days.length < 3; step++) {
    const date = cursor.toISOString().slice(0, 10);
    if (
      isBusinessDay(date) &&
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

/** ": 2 horários novos · 1 serviço removido", for the unsaved-changes bar. */
function summarize(
  saved: { grid: Grid; services: ServiceDraft[]; modes: string[] },
  current: { grid: Grid; services: ServiceDraft[]; modes: string[] },
): string {
  const phrases: string[] = [];

  const flat = (grid: Grid) =>
    Object.entries(grid).flatMap(([day, times]) =>
      times.map((time) => `${day}|${time}`),
    );
  const savedTimes = new Set(flat(saved.grid));
  const currentTimes = new Set(flat(current.grid));
  const addedTimes = [...currentTimes].filter((t) => !savedTimes.has(t)).length;
  const removedTimes = [...savedTimes].filter(
    (t) => !currentTimes.has(t),
  ).length;
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

  const savedLabels = new Set(saved.services.map((s) => s.label));
  const currentLabels = new Set(current.services.map((s) => s.label));
  const addedServices = current.services.filter(
    (s) => !savedLabels.has(s.label),
  ).length;
  const removedServices = saved.services.filter(
    (s) => !currentLabels.has(s.label),
  ).length;
  const toggled = current.services.filter((s) =>
    saved.services.some(
      (item) => item.label === s.label && item.notaryOnly !== s.notaryOnly,
    ),
  ).length;
  if (addedServices > 0) {
    phrases.push(
      `${addedServices} ${addedServices === 1 ? "serviço novo" : "serviços novos"}`,
    );
  }
  if (removedServices > 0) {
    phrases.push(
      `${removedServices} ${removedServices === 1 ? "serviço removido" : "serviços removidos"}`,
    );
  }
  if (toggled > 0) {
    phrases.push(
      `${toggled} ${toggled === 1 ? "serviço marcado" : "serviços marcados"} "só com o tabelião"`,
    );
  }

  if (
    JSON.stringify([...saved.modes].sort()) !==
    JSON.stringify([...current.modes].sort())
  ) {
    phrases.push("modos alterados");
  }

  return phrases.length > 0 ? `: ${phrases.slice(0, 2).join(" · ")}` : "";
}
