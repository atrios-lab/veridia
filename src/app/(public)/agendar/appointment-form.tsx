"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { startTransition, useActionState } from "react";
import { type UseFormRegisterReturn, useForm } from "react-hook-form";
import { appointmentSchema } from "@/core/request/channels.ts";
import { formatPhone, maskCpf } from "@/core/request/form.ts";
import {
  type AgendaId,
  type SlotTime,
  slotEndTime,
} from "@/core/scheduling/agenda.ts";
import {
  dayOfMonth,
  formatLongDate,
  formatShortDate,
  type IsoDate,
  shortMonth,
  shortWeekday,
} from "@/core/scheduling/calendar.ts";
import {
  CHECKLIST_CAVEAT,
  checklistFileHref,
  checklistFor,
  documentsByEmailNotice,
  type OfferedService,
} from "@/core/scheduling/services.ts";
import { Icon } from "../_components/icon.tsx";
import { withMask } from "../_lib/mask.ts";
import {
  type AppointmentState,
  type AppointmentSuccess,
  submitAppointment,
} from "./actions.ts";

const inputClass =
  "w-full rounded-xl border border-brand-border bg-brand-card px-3.5 py-3 text-sm text-brand-text outline-none placeholder:text-brand-faint focus:border-brand-accent";

const digits = (value: string) => value.replace(/\D/g, "");

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-xs font-semibold text-brand-alert">{message}</p>
  );
}

export interface AgendaChoice {
  id: AgendaId;
  name: string;
  short: string;
  description: string;
}

/** The address of a day in an agenda, the one link every chip builds. */
function dayHref(agenda: AgendaId | undefined, day: IsoDate): string {
  return agenda
    ? `/agendar?agenda=${agenda}&dia=${day}`
    : `/agendar?dia=${day}`;
}

export interface SchedulingScreenProps {
  openingHours: string;
  phone: string;
  whatsapp: string;
  /** The office's e-mail, for documents sent ahead with a doubt. */
  email: string;
  /** Set when there is nothing to offer, and why: the two cases read very
   * differently to the citizen and must not share a screen. */
  unavailable?: "unconfigured" | "full";
  /** The agendas the site offers; with two and none chosen, the page asks
   * which one first. */
  agendas?: AgendaChoice[];
  agenda?: AgendaId;
  days?: IsoDate[];
  selected?: IsoDate;
  times?: SlotTime[];
  services?: OfferedService[];
  modes?: string[];
  /** The notary's channels for the day, label to explanation: present, the
   * form asks how to be attended with cards instead of a select. */
  modeHints?: Record<string, string>;
  nextFreeDay?: IsoDate;
  nextFreeTime?: SlotTime;
}

/**
 * The whole page, because the confirmation takes its place. Once the time is
 * booked there is nothing left to choose, and leaving the day chips and the
 * sidebar on screen would invite the citizen to book the same visit twice.
 */
export function SchedulingScreen(props: SchedulingScreenProps) {
  const [state, formAction, pending] = useActionState<
    AppointmentState,
    FormData
  >(submitAppointment, { status: "idle" });

  if (state.status === "success") return <ConfirmationScreen result={state} />;

  const { days, selected, times, services, modes, agenda } = props;
  const agendas = props.agendas ?? [];

  return (
    <div className="md:grid md:grid-cols-[1fr_320px] md:items-start md:gap-9">
      {/* min-w-0, or the scrolling row of days widens the column instead of
          scrolling inside it, and the whole page scrolls sideways. */}
      <div className="min-w-0">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-accent-ink">
          Atendimento presencial
        </span>
        <h1 className="mt-2 font-serif text-2xl font-semibold text-brand-primary md:text-3xl">
          Escolha quando vir à serventia
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-brand-muted md:text-sm">
          {props.openingHours}. Escolha um horário livre: ele fica reservado no
          seu nome na hora.
        </p>

        {props.unavailable ? (
          <NoTimes
            reason={props.unavailable}
            phone={props.phone}
            whatsapp={props.whatsapp}
          />
        ) : !agenda ? (
          <AgendaChooser agendas={agendas} />
        ) : (
          <>
            {agendas.length > 1 && (
              <AgendaSwitch agendas={agendas} current={agenda} />
            )}
            <div className="mt-6">
              <span className="mb-2 block text-[13px] font-bold text-brand-primary">
                Dia
              </span>
              {/* Links, not a date field: only the days the office receives on
                  exist here, so a weekend, a holiday or a day it does not open
                  cannot be typed in. */}
              <ul className="flex gap-2 overflow-x-auto pb-1">
                {days?.map((day) => {
                  const chosen = day === selected;
                  return (
                    <li key={day} className="shrink-0">
                      <Link
                        href={dayHref(agenda, day)}
                        scroll={false}
                        aria-current={chosen ? "date" : undefined}
                        className={`block w-[62px] rounded-xl border py-2 text-center md:w-[78px] ${
                          chosen
                            ? "border-brand-primary bg-brand-primary text-white"
                            : "border-brand-border bg-brand-card text-brand-primary hover:border-brand-accent"
                        }`}
                      >
                        <span className="block text-[10px] uppercase tracking-[0.08em] opacity-70">
                          {shortWeekday(day)}
                        </span>
                        <span className="block text-[17px] font-bold md:text-[19px]">
                          {dayOfMonth(day)}
                        </span>
                        <span className="block text-[10px] opacity-70">
                          {shortMonth(day)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-1.5 text-[11px] text-brand-faint">
                Só os dias em que a serventia atende com hora marcada.
              </p>
            </div>

            {times && times.length === 0 ? (
              <DayIsFull
                agenda={agenda}
                selected={selected ?? ""}
                nextFreeDay={props.nextFreeDay}
                nextFreeTime={props.nextFreeTime}
                whatsapp={props.whatsapp}
              />
            ) : (
              <AppointmentForm
                agenda={agenda}
                date={selected ?? ""}
                dateLabel={formatShortDate(selected ?? "")}
                times={times ?? []}
                services={services ?? []}
                modes={modes ?? []}
                modeHints={props.modeHints}
                officeEmail={props.email}
                state={state}
                formAction={formAction}
                pending={pending}
              />
            )}
          </>
        )}
      </div>

      <aside className="mt-6 flex flex-col gap-3.5 md:mt-9">
        <div className="rounded-2xl border border-brand-border bg-brand-card p-5">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-accent-ink">
            Como funciona
          </span>
          <ol className="mt-3 flex flex-col gap-3">
            {[
              ["Você escolhe", "A agenda, o dia, o horário livre e o serviço."],
              [
                "Confirmação na hora",
                "O horário fica no seu nome. Você recebe o comprovante em PDF e a lista do que trazer.",
              ],
              [
                "Você comparece",
                "15 minutos antes do horário, com os documentos da lista e o comprovante.",
              ],
            ].map(([title, detail], index) => (
              <li key={title} className="flex gap-2.5">
                <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[11.5px] font-bold text-brand-primary">
                  {index + 1}
                </span>
                <div>
                  <div className="text-[13px] font-bold text-brand-primary">
                    {title}
                  </div>
                  <div className="text-[12px] leading-relaxed text-brand-muted">
                    {detail}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex items-start gap-2.5 rounded-2xl bg-brand-accent-soft px-3.5 py-3">
          <Icon
            name="info"
            className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent-ink"
            strokeWidth={2}
          />
          <p className="text-[12px] leading-relaxed text-brand-accent-ink">
            Precisa de um ato específico? Use{" "}
            <Link href="/solicitar" className="font-semibold underline">
              Solicitar serviço
            </Link>
            : o pedido adianta a análise e você só vem ao balcão para concluir.
          </p>
        </div>
      </aside>
    </div>
  );
}

/**
 * Nothing to offer. An office that has not set its agenda up is a different
 * message from one whose next weeks are full: the first is fixed by calling,
 * the second by trying later, and telling a citizen to call when the counter
 * is simply booked wastes everyone's morning.
 */
function NoTimes({
  reason,
  phone,
  whatsapp,
}: {
  reason: "unconfigured" | "full";
  phone: string;
  whatsapp: string;
}) {
  return (
    <div className="mt-6 rounded-2xl border-[1.5px] border-brand-accent-line bg-brand-card p-5">
      <div className="flex items-start gap-2.5">
        <Icon
          name="info"
          className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent"
          strokeWidth={2}
        />
        <div>
          <div className="text-sm font-bold text-brand-primary">
            {reason === "unconfigured"
              ? "Agendamento pelo telefone"
              : "Sem horários livres no momento"}
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-brand-muted">
            {reason === "unconfigured"
              ? "Esta serventia ainda não publicou horários para agendamento pelo site. Fale com o cartório para marcar o seu atendimento."
              : "Os próximos dias de atendimento já estão todos preenchidos. Tente de novo em alguns dias ou fale com a serventia."}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 md:flex-row">
        <a href={`tel:${digits(phone)}`} className="btn btn-primary btn-lg">
          Ligar para {phone}
        </a>
        <a
          href={`https://wa.me/55${digits(whatsapp)}`}
          className="btn btn-secondary btn-lg"
        >
          Falar no WhatsApp
        </a>
      </div>
    </div>
  );
}

function DayIsFull({
  agenda,
  selected,
  nextFreeDay,
  nextFreeTime,
  whatsapp,
}: {
  agenda?: AgendaId;
  selected: IsoDate;
  nextFreeDay?: IsoDate;
  nextFreeTime?: SlotTime;
  whatsapp: string;
}) {
  return (
    <div className="mt-5 rounded-2xl border-[1.5px] border-brand-accent-line bg-brand-card p-4">
      <div className="flex items-start gap-2.5">
        <Icon
          name="info"
          className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent"
          strokeWidth={2}
        />
        <div>
          <div className="text-sm font-bold text-brand-primary">
            Este dia está cheio
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-brand-muted">
            {formatShortDate(selected)} não tem mais horários livres.{" "}
            {nextFreeDay && nextFreeTime ? (
              <>
                O próximo dia com vaga é{" "}
                <strong>{formatShortDate(nextFreeDay)}</strong>, a partir das{" "}
                {nextFreeTime}.
              </>
            ) : (
              "Os próximos dias oferecidos também estão cheios: fale com a serventia."
            )}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        {nextFreeDay && (
          <Link
            href={dayHref(agenda, nextFreeDay)}
            scroll={false}
            className="btn btn-primary btn-lg flex-1"
          >
            Ver {formatShortDate(nextFreeDay)}
          </Link>
        )}
        <a
          href={`https://wa.me/55${digits(whatsapp)}`}
          className="btn btn-secondary btn-lg shrink-0"
        >
          Falar no WhatsApp
        </a>
      </div>
      <p className="mt-3 text-[11.5px] leading-relaxed text-brand-faint">
        Urgências continuam pelo balcão e pelo telefone.
      </p>
    </div>
  );
}

function AppointmentForm({
  agenda,
  date,
  dateLabel,
  times,
  services,
  modes,
  modeHints,
  officeEmail,
  state,
  formAction,
  pending,
}: {
  agenda: AgendaId;
  date: string;
  dateLabel: string;
  times: SlotTime[];
  services: OfferedService[];
  modes: string[];
  modeHints?: Record<string, string>;
  officeEmail: string;
  state: AppointmentState;
  formAction: (payload: FormData) => void;
  pending: boolean;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors: clientErrors },
  } = useForm({
    resolver: zodResolver(
      appointmentSchema({
        serviceIds: services.map((service) => service.id),
        modes,
      }),
    ),
    mode: "onTouched",
  });

  const serverErrors = state.status === "error" ? state.fieldErrors : {};
  const errorFor = (name: keyof typeof clientErrors & string) =>
    (clientErrors[name]?.message as string | undefined) ?? serverErrors[name];

  const onSubmit = handleSubmit((_data, event) => {
    const form = event?.target as HTMLFormElement;
    startTransition(() => formAction(new FormData(form)));
  });

  return (
    <form onSubmit={onSubmit} noValidate className="mt-5">
      <input type="hidden" value={date} {...register("date")} />
      <input type="hidden" name="agenda" value={agenda} />

      {/* Off screen and out of the tab order: nobody using the site can reach
          it, so anything in it came from a script. */}
      <div
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 overflow-hidden"
      >
        <label htmlFor="website">Não preencha este campo</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <fieldset>
        <legend className="mb-2 text-[13px] font-bold text-brand-primary">
          Horário{" "}
          <span className="font-normal text-brand-muted">· {dateLabel}</span>
        </legend>
        <div className="grid grid-cols-3 gap-2 md:flex md:flex-wrap">
          {times.map((time) => (
            <label
              key={time}
              className="relative cursor-pointer rounded-xl border border-brand-border bg-brand-card py-2.5 text-center text-brand-primary hover:border-brand-accent has-[:checked]:border-brand-primary has-[:checked]:bg-brand-primary has-[:checked]:text-white has-[:focus-visible]:border-brand-accent md:w-[112px]"
            >
              {/* The control covers the card: clicking anywhere on it is
                  clicking the radio, and the radio keeps its own focus. */}
              <input
                type="radio"
                value={time}
                className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
                {...register("slotTime")}
              />
              <span className="block text-[13px] font-bold md:text-sm">
                {time}
              </span>
              <span className="mt-0.5 block text-[10px] opacity-70">
                até {slotEndTime(time)}
              </span>
            </label>
          ))}
        </div>
        <FieldError message={errorFor("slotTime")} />
        <p className="mt-1.5 text-[11px] text-brand-faint">
          Só aparecem os horários ainda livres. O que você escolher fica no seu
          nome.
        </p>
      </fieldset>

      <div className="mt-5 flex flex-col gap-3.5">
        <div className="grid gap-3.5 md:grid-cols-2">
          <div>
            <label
              htmlFor="serviceId"
              className="mb-1.5 block text-[13px] font-semibold"
            >
              Do que você precisa
            </label>
            <select
              id="serviceId"
              className={inputClass}
              defaultValue=""
              {...register("serviceId")}
            >
              <option value="" disabled>
                Escolha o serviço
              </option>
              {groupServices(services).map(({ group, items }) => (
                <optgroup key={group} label={group}>
                  {items.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <FieldError message={errorFor("serviceId")} />
          </div>

          {modeHints ? (
            <ChannelChoice
              modes={modes}
              hints={modeHints}
              register={register("mode")}
              error={errorFor("mode")}
            />
          ) : (
            <div>
              <label
                htmlFor="mode"
                className="mb-1.5 block text-[13px] font-semibold"
              >
                Modo de atendimento
              </label>
              <select
                id="mode"
                className={inputClass}
                defaultValue=""
                {...register("mode")}
              >
                <option value="" disabled>
                  Escolha como quer ser atendido
                </option>
                {modes.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
              <FieldError message={errorFor("mode")} />
            </div>
          )}
        </div>

        {/* Said while the citizen is still choosing: a service whose papers
            they do not have is worth knowing about before taking the hour. */}
        <BringPreview
          service={services.find((item) => item.id === watch("serviceId"))}
        />
        <DocumentsByEmail email={officeEmail} />

        <div>
          <label
            htmlFor="serviceDetails"
            className="mb-1.5 block text-[13px] font-semibold"
          >
            Descreva o que você precisa
          </label>
          <textarea
            id="serviceDetails"
            rows={3}
            className={inputClass}
            placeholder="Ex.: qual documento você precisa e para que ele vai servir."
            {...register("serviceDetails")}
          />
          <FieldError message={errorFor("serviceDetails")} />
        </div>

        <div>
          <label
            htmlFor="citizenName"
            className="mb-1.5 block text-[13px] font-semibold"
          >
            Nome completo
          </label>
          <input
            id="citizenName"
            autoComplete="name"
            className={inputClass}
            {...register("citizenName")}
          />
          <FieldError message={errorFor("citizenName")} />
        </div>

        <div className="grid gap-3.5 md:grid-cols-2">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-[13px] font-semibold"
            >
              E-mail{" "}
              <span className="font-normal text-brand-muted">
                · a confirmação vai para cá
              </span>
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className={inputClass}
              placeholder="voce@exemplo.com"
              {...register("email")}
            />
            <FieldError message={errorFor("email")} />
          </div>

          <div>
            <label
              htmlFor="phone"
              className="mb-1.5 block text-[13px] font-semibold"
            >
              Telefone
            </label>
            <input
              id="phone"
              inputMode="tel"
              autoComplete="tel"
              className={inputClass}
              placeholder="(84) 90000-0000"
              {...withMask(register("phone"), formatPhone)}
            />
            <FieldError message={errorFor("phone")} />
          </div>
        </div>

        <div className="md:max-w-[50%] md:pr-1.75">
          <label
            htmlFor="cpf"
            className="mb-1.5 block text-[13px] font-semibold"
          >
            CPF <span className="font-normal text-brand-muted">· opcional</span>
          </label>
          <input
            id="cpf"
            inputMode="numeric"
            className={inputClass}
            placeholder="000.000.000-00"
            {...withMask(register("cpf"), maskCpf)}
          />
          <FieldError message={errorFor("cpf")} />
        </div>
      </div>

      {state.status === "error" && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-brand-alert px-3.5 py-3 text-[13px] font-semibold text-brand-alert"
        >
          {state.message}
        </p>
      )}

      {/* The expectation sits with the button, where it is being made, and not
          above the form where it is read before there is anything to promise. */}
      <div className="mt-5 md:flex md:flex-row-reverse md:items-center md:justify-end md:gap-4">
        <div className="flex items-start gap-2.5 rounded-xl bg-brand-accent-soft px-3.5 py-3 md:max-w-[44ch] md:bg-transparent md:px-0 md:py-0">
          <Icon
            name="calendar"
            className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent-ink md:hidden"
            strokeWidth={1.9}
          />
          <p className="text-[12px] leading-relaxed text-brand-accent-ink">
            O horário fica <strong>marcado na hora</strong>. A confirmação, com
            o link para cancelar, chega no e-mail informado acima.
          </p>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary btn-lg mt-3 w-full md:mt-0 md:w-auto md:shrink-0 md:px-7 md:py-3.5"
        >
          {pending ? "Agendando..." : "Confirmar agendamento"}
        </button>
      </div>
    </form>
  );
}

/**
 * How the notary attends on the chosen day: the channels he picked for it,
 * as cards with what each one means. A day with a single channel says so
 * instead of asking, and still sends it with the form.
 */
function ChannelChoice({
  modes,
  hints,
  register,
  error,
}: {
  modes: string[];
  hints: Record<string, string>;
  register: UseFormRegisterReturn;
  error?: string;
}) {
  if (modes.length === 1) {
    return (
      <div>
        <span className="mb-1.5 block text-[13px] font-semibold">
          Como você será atendido
        </span>
        <input type="hidden" value={modes[0]} {...register} />
        <p className="rounded-xl border border-brand-border bg-brand-card px-3.5 py-3 text-[13px] text-brand-text">
          <strong>{modes[0]}</strong>
          <span className="block text-[12px] text-brand-muted">
            Neste dia o tabelião atende só assim. {hints[modes[0]]}
          </span>
        </p>
        <FieldError message={error} />
      </div>
    );
  }
  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-semibold">
        Como você quer ser atendido
      </legend>
      <div className="flex flex-col gap-2">
        {modes.map((mode) => (
          <label
            key={mode}
            className="relative flex cursor-pointer flex-col rounded-xl border border-brand-border bg-brand-card px-3.5 py-2.5 hover:border-brand-accent has-[:checked]:border-brand-primary has-[:checked]:bg-brand-tint has-[:focus-visible]:border-brand-accent"
          >
            <input
              type="radio"
              value={mode}
              className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
              {...register}
            />
            <span className="text-[13px] font-bold text-brand-primary">
              {mode}
            </span>
            <span className="text-[12px] leading-snug text-brand-muted">
              {hints[mode]}
            </span>
          </label>
        ))}
      </div>
      <FieldError message={error} />
    </fieldset>
  );
}

/**
 * The first question when the office keeps two agendas: with whom. Links,
 * like the day chips, so the choice lives in the address and the back
 * button undoes it.
 */
function AgendaChooser({ agendas }: { agendas: AgendaChoice[] }) {
  return (
    <div className="mt-6">
      <span className="mb-2 block text-[13px] font-bold text-brand-primary">
        Com quem é o seu atendimento?
      </span>
      <ul className="grid gap-3 md:grid-cols-2">
        {agendas.map((choice) => (
          <li key={choice.id}>
            <Link
              href={`/agendar?agenda=${choice.id}`}
              className="flex h-full flex-col rounded-2xl border border-brand-border bg-brand-card p-4 hover:border-brand-accent"
            >
              <span className="flex items-center gap-2 text-[15px] font-bold text-brand-primary">
                <Icon
                  name="calendar"
                  className="h-4.5 w-4.5 shrink-0 text-brand-accent"
                  strokeWidth={2}
                />
                {choice.name}
              </span>
              <span className="mt-1.5 text-[12.5px] leading-relaxed text-brand-muted">
                {choice.description}
              </span>
              <span className="mt-3 text-[12.5px] font-bold text-brand-accent-ink">
                Ver dias e horários →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Which agenda is open, and the other one a tap away. */
function AgendaSwitch({
  agendas,
  current,
}: {
  agendas: AgendaChoice[];
  current: AgendaId;
}) {
  return (
    <nav aria-label="Agenda" className="mt-5 flex flex-wrap gap-2">
      {agendas.map((choice) => {
        const chosen = choice.id === current;
        return (
          <Link
            key={choice.id}
            href={`/agendar?agenda=${choice.id}`}
            scroll={false}
            aria-current={chosen ? "page" : undefined}
            className={`rounded-full border px-4 py-2 text-[13px] font-semibold ${
              chosen
                ? "border-brand-primary bg-brand-primary text-white"
                : "border-brand-border bg-brand-card text-brand-primary hover:border-brand-accent"
            }`}
          >
            {choice.name}
          </Link>
        );
      })}
    </nav>
  );
}

/** The services under their headings, in the order they came. */
function groupServices(
  services: OfferedService[],
): Array<{ group: string; items: OfferedService[] }> {
  const groups: Array<{ group: string; items: OfferedService[] }> = [];
  for (const service of services) {
    const entry = groups.find((item) => item.group === service.group);
    if (entry) entry.items.push(service);
    else groups.push({ group: service.group, items: [service] });
  }
  return groups;
}

/** What the chosen service asks the citizen to bring. */
function BringPreview({ service }: { service?: OfferedService }) {
  if (!service) return null;
  return (
    <div className="rounded-xl border border-brand-border bg-brand-card px-4 py-3">
      <div className="text-[13px] font-bold text-brand-primary">
        O que trazer para {service.label.toLowerCase()}
      </div>
      <ChecklistItems items={checklistFor(service)} />
      {service.note && (
        <p className="mt-2 text-[12px] leading-relaxed text-brand-muted">
          {service.note}
        </p>
      )}
      {service.hasOwnFile && (
        <OwnListLink href={checklistFileHref(service.id)} />
      )}
    </div>
  );
}

/**
 * Documents can be sent ahead, by e-mail, when the citizen is unsure about
 * one: said next to the list, with the address as a link.
 */
function DocumentsByEmail({ email }: { email: string }) {
  if (!email) return null;
  const [before, after] = documentsByEmailNotice(email).split(email);
  return (
    <p className="flex items-start gap-2 rounded-xl bg-brand-accent-soft px-3.5 py-3 text-[12.5px] leading-relaxed text-brand-accent-ink">
      <Icon name="mail" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.9} />
      <span>
        {before}
        <a href={`mailto:${email}`} className="font-bold underline">
          {email}
        </a>
        {after}
      </span>
    </p>
  );
}

/** The office's own sheet for the service, opened in a new tab. */
function OwnListLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="mt-2.5 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-brand-accent-ink underline"
    >
      <Icon name="file" className="h-3.5 w-3.5" strokeWidth={2} />
      Baixar a lista do cartório para este serviço
    </a>
  );
}

function ChecklistItems({ items }: { items: string[] }) {
  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {items.map((item) => (
        <li
          key={item}
          className="flex gap-2 text-[12.5px] leading-relaxed text-brand-text"
        >
          <Icon
            name="check"
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-accent"
            strokeWidth={2.4}
          />
          {item}
        </li>
      ))}
    </ul>
  );
}

function ConfirmationScreen({ result }: { result: AppointmentSuccess }) {
  const when = `${result.slotTime} às ${slotEndTime(result.slotTime)}`;

  return (
    <div className="md:mx-auto md:max-w-3xl">
      {/* On a phone the confirmation owns the screen, so the heading carries
          its own dark field; on desktop it sits on the page, as the redesign
          draws it. */}
      <div className="rounded-t-2xl bg-brand-primary px-5 py-6 text-center md:hidden">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary-soft">
          <Icon
            name="calendar"
            className="h-6 w-6 text-brand-on-dark-accent"
            strokeWidth={2.2}
          />
        </span>
        <h1 className="mt-3 font-serif text-[23px] font-semibold text-white">
          Agendamento confirmado
        </h1>
        <p className="mt-1 text-[13px] text-brand-on-dark-body">
          {formatLongDate(result.date)} · {when}
        </p>
        {result.protocolNumber && (
          <p className="mt-1 text-[12px] text-brand-on-dark-body">
            Protocolo {result.protocolNumber}
          </p>
        )}
      </div>

      <div className="hidden items-center gap-4 md:flex">
        <span className="inline-flex h-13 w-13 shrink-0 items-center justify-center rounded-full bg-brand-primary-soft">
          <Icon
            name="calendar"
            className="h-6.5 w-6.5 text-brand-on-dark-accent"
            strokeWidth={2.2}
          />
        </span>
        <div>
          <h1 className="font-serif text-[28px] font-semibold text-brand-primary">
            Agendamento confirmado
          </h1>
          <p className="text-[13.5px] text-brand-muted">
            {formatLongDate(result.date)} · {when}
            {result.serviceLabel && ` · ${result.serviceLabel}`}
          </p>
          <p className="text-[12.5px] text-brand-muted">
            {[
              result.agendaName,
              result.protocolNumber && `Protocolo ${result.protocolNumber}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      {/* The one instruction that decides whether the visit works: said
          first and loudest, before the papers. */}
      {result.arrival && (
        <div className="mt-0 flex items-start gap-2.5 border-x border-brand-border bg-brand-accent-soft px-5 py-3.5 md:mt-5 md:rounded-2xl md:border-0">
          <Icon
            name="clock"
            className="mt-0.5 h-4.5 w-4.5 shrink-0 text-brand-accent-ink"
            strokeWidth={2}
          />
          <p className="text-[13.5px] font-semibold leading-relaxed text-brand-accent-ink">
            {result.arrival}
          </p>
        </div>
      )}

      <div className="rounded-b-2xl border border-brand-border bg-brand-card p-5 md:mt-4 md:rounded-2xl">
        <div className="text-[14px] font-bold text-brand-primary">
          {result.remote ? "O que ter em mãos" : "O que trazer"}
        </div>
        <ChecklistItems items={result.checklist} />
        {result.serviceNote && (
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-brand-muted">
            {result.serviceNote}
          </p>
        )}
        {result.checklistUrl && <OwnListLink href={result.checklistUrl} />}
        <p className="mt-2.5 text-[12px] leading-relaxed text-brand-muted">
          {result.caveat || CHECKLIST_CAVEAT}
        </p>
        {result.officeEmail && (
          <div className="mt-3">
            <DocumentsByEmail email={result.officeEmail} />
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2.5 rounded-2xl border border-brand-border bg-brand-card p-4">
        <Icon
          name="mail"
          className="mt-0.5 h-4.5 w-4.5 shrink-0 text-brand-accent"
          strokeWidth={1.9}
        />
        <div>
          <div className="text-[13.5px] font-bold text-brand-primary">
            A confirmação foi para {result.email}
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-brand-muted">
            Com o comprovante em PDF, a lista do que trazer e o link para
            cancelar, caso você não possa vir. Não achou? Confira a caixa de
            spam.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2.5 md:flex-row">
        {/* POST, not a link: the token would otherwise sit in the address bar,
            in the browser history and in every access log on the way. */}
        <form action="/agendar/comprovante" method="post" className="flex-1">
          <input type="hidden" name="token" value={result.cancelToken} />
          <button type="submit" className="btn btn-primary btn-lg w-full">
            Baixar comprovante (PDF)
          </button>
        </form>
        <form action="/agendar/agenda" method="post" className="flex-1">
          <input type="hidden" name="token" value={result.cancelToken} />
          <button type="submit" className="btn btn-secondary btn-lg w-full">
            Adicionar à agenda
          </button>
        </form>
        <Link href="/" className="btn btn-secondary btn-lg md:shrink-0">
          Voltar ao início
        </Link>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-brand-faint">
        {result.remote
          ? "O comprovante sai com o timbre da serventia, o horário e a lista do que ter em mãos."
          : "O comprovante sai com o timbre da serventia e a lista do que trazer. Apresente-o na recepção, impresso ou no celular."}
      </p>
    </div>
  );
}
