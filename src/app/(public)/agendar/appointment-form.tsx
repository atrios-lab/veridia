"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { appointmentSchema } from "@/core/request/channels.ts";
import { formatPhone, maskCpf } from "@/core/request/form.ts";
import {
  type AgendaService,
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

export interface SchedulingScreenProps {
  openingHours: string;
  phone: string;
  whatsapp: string;
  /** Set when there is nothing to offer, and why: the two cases read very
   * differently to the citizen and must not share a screen. */
  unavailable?: "unconfigured" | "full";
  days?: IsoDate[];
  selected?: IsoDate;
  times?: SlotTime[];
  services?: AgendaService[];
  modes?: string[];
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

  const { days, selected, times, services, modes } = props;

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
        ) : (
          <>
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
                        href={`/agendar?dia=${day}`}
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
                selected={selected ?? ""}
                nextFreeDay={props.nextFreeDay}
                nextFreeTime={props.nextFreeTime}
                whatsapp={props.whatsapp}
              />
            ) : (
              <AppointmentForm
                date={selected ?? ""}
                dateLabel={formatShortDate(selected ?? "")}
                times={times ?? []}
                services={services ?? []}
                modes={modes ?? []}
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
              ["Você escolhe", "Um dia e um horário livre, e o serviço."],
              [
                "Confirmação na hora",
                "O horário fica no seu nome e a confirmação chega no seu e-mail.",
              ],
              [
                "Você comparece",
                "No dia e hora marcados, com documento com foto.",
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
  selected,
  nextFreeDay,
  nextFreeTime,
  whatsapp,
}: {
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
            href={`/agendar?dia=${nextFreeDay}`}
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
  date,
  dateLabel,
  times,
  services,
  modes,
  state,
  formAction,
  pending,
}: {
  date: string;
  dateLabel: string;
  times: SlotTime[];
  services: AgendaService[];
  modes: string[];
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
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.label}
                  {service.notaryOnly ? " · só com o tabelião" : ""}
                </option>
              ))}
            </select>
            {/* Said before the citizen commits to an hour: an appointment
                that depends on the notary being in is worth knowing about
                while there is still time to pick another service or day. */}
            {services.find((service) => service.id === watch("serviceId"))
              ?.notaryOnly && (
              <p className="mt-1.5 text-[12px] leading-relaxed text-brand-muted">
                Este serviço é atendido só com o tabelião presente.
              </p>
            )}
            <FieldError message={errorFor("serviceId")} />
          </div>

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
        </div>
      </div>

      <div className="rounded-b-2xl border border-brand-border bg-brand-card p-5 md:mt-5 md:rounded-2xl">
        <div className="flex gap-2.5">
          <Icon
            name="mail"
            className="mt-0.5 h-4.5 w-4.5 shrink-0 text-brand-accent"
            strokeWidth={1.9}
          />
          <div>
            <div className="text-[14px] font-bold text-brand-primary">
              A confirmação foi para {result.email}
            </div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-brand-muted">
              Nela vão o dia, o horário e o link para cancelar, caso você não
              possa vir. Não achou? Confira a caixa de spam.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2.5 md:grid md:grid-cols-2">
        <div className="flex gap-2.5 rounded-2xl border border-brand-border bg-brand-card p-3.5">
          <Icon
            name="shield"
            className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent"
            strokeWidth={1.9}
          />
          <div>
            <div className="text-[13.5px] font-bold text-brand-primary">
              Leve um documento com foto
            </div>
            <p className="mt-0.5 text-[12px] leading-relaxed text-brand-muted">
              O agendamento vale para você; se for por outra pessoa, leve
              procuração.
            </p>
          </div>
        </div>
        <div className="flex gap-2.5 rounded-2xl border border-brand-border bg-brand-card p-3.5">
          <Icon
            name="clock"
            className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent"
            strokeWidth={1.9}
          />
          <div>
            <div className="text-[13.5px] font-bold text-brand-primary">
              Chegue alguns minutos antes
            </div>
            <p className="mt-0.5 text-[12px] leading-relaxed text-brand-muted">
              O horário é seu, mas a conferência de documentos começa na
              recepção.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2.5">
        {/* POST, not a link: the token would otherwise sit in the address bar,
            in the browser history and in every access log on the way. */}
        <form action="/agendar/agenda" method="post" className="flex-1">
          <input type="hidden" name="token" value={result.cancelToken} />
          <button type="submit" className="btn btn-primary btn-lg w-full">
            Adicionar à agenda
          </button>
        </form>
        <Link href="/" className="btn btn-secondary btn-lg shrink-0">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
