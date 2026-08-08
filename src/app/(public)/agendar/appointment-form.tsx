"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { appointmentSchema } from "@/core/request/channels.ts";
import { formatPhone } from "@/core/request/form.ts";
import {
  dayOfMonth,
  formatLongDate,
  formatShortDate,
  type IsoDate,
  shortMonth,
  shortWeekday,
} from "@/core/scheduling/calendar.ts";
import type { Slot } from "@/core/scheduling/slots.ts";
import { Icon } from "../_components/icon.tsx";
import { ProtocolReveal } from "../_components/protocol-reveal.tsx";
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
  whatsapp: string;
  days: IsoDate[];
  selected: IsoDate;
  bands: Slot[];
  dayIsFull: boolean;
  nextFreeDay?: IsoDate;
  nextFreeHour?: number;
}

/**
 * The whole page, because the confirmation takes its place. Once the request
 * is filed there is nothing left to choose, and leaving the day chips and the
 * sidebar on screen would invite the citizen to book the same visit twice.
 */
export function SchedulingScreen(props: SchedulingScreenProps) {
  const [state, formAction, pending] = useActionState<
    AppointmentState,
    FormData
  >(submitAppointment, { status: "idle" });

  if (state.status === "success") return <ConfirmationScreen result={state} />;

  const { days, selected, bands, dayIsFull, nextFreeDay, nextFreeHour } = props;

  return (
    <div className="md:grid md:grid-cols-[1fr_320px] md:items-start md:gap-9">
      {/* min-w-0, or the scrolling row of days widens the column instead of
          scrolling inside it, and the whole page scrolls sideways. */}
      <div className="min-w-0">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-accent">
          Atendimento presencial
        </span>
        <h1 className="mt-2 font-serif text-2xl font-semibold text-brand-primary md:text-3xl">
          Escolha quando vir à serventia
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-brand-muted md:text-sm">
          {props.openingHours}. O motivo é livre: não precisa saber o nome do
          ato.
        </p>

        <div className="mt-6">
          <span className="mb-2 block text-[13px] font-bold text-brand-primary">
            Dia
          </span>
          {/* Links, not a date field: only the days the office opens exist
              here, so a weekend or a holiday cannot be typed in. */}
          <ul className="flex gap-2 overflow-x-auto pb-1">
            {days.map((day) => {
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
            Só dias de atendimento: fins de semana e feriados não aparecem.
          </p>
        </div>

        {dayIsFull ? (
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
                  {formatShortDate(selected)} não tem mais faixas.{" "}
                  {nextFreeDay && nextFreeHour !== undefined ? (
                    <>
                      O próximo dia com vaga é{" "}
                      <strong>{formatShortDate(nextFreeDay)}</strong>, a partir
                      das {nextFreeHour}h.
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
                  className="flex-1 rounded-xl bg-brand-primary px-3 py-3 text-center text-[13px] font-semibold text-white hover:bg-brand-primary-soft"
                >
                  Ver {formatShortDate(nextFreeDay)}
                </Link>
              )}
              <a
                href={`https://wa.me/55${digits(props.whatsapp)}`}
                className="shrink-0 rounded-xl border border-brand-border bg-brand-surface px-4 py-3 text-center text-[13px] font-semibold text-brand-primary"
              >
                Falar no WhatsApp
              </a>
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-brand-faint">
              Nada é enviado sem faixa escolhida: você não fica esperando uma
              confirmação que não viria. Urgências continuam pelo balcão e pelo
              telefone.
            </p>
          </div>
        ) : (
          <AppointmentForm
            date={selected}
            dateLabel={formatShortDate(selected)}
            bands={bands}
            state={state}
            formAction={formAction}
            pending={pending}
          />
        )}
      </div>

      <aside className="mt-6 flex flex-col gap-3.5 md:mt-9">
        <div className="rounded-2xl border border-brand-border bg-brand-card p-5">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-accent">
            Como funciona
          </span>
          <ol className="mt-3 flex flex-col gap-3">
            {[
              ["Você pede", "Informa dia, faixa de horário e contato."],
              [
                "A serventia confirma",
                "Confirma o horário ou propõe outro pelo seu contato.",
              ],
              [
                "Você comparece",
                "No dia e hora confirmados, com documento com foto.",
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
            className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent"
            strokeWidth={2}
          />
          <p className="text-[12px] leading-relaxed text-brand-accent">
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

function AppointmentForm({
  date,
  dateLabel,
  bands,
  state,
  formAction,
  pending,
}: {
  date: string;
  dateLabel: string;
  bands: Slot[];
  state: AppointmentState;
  formAction: (payload: FormData) => void;
  pending: boolean;
}) {
  // The office's window, as the rendered bands describe it. Capacity is the
  // server's business: here it only has to know which hours exist.
  const {
    register,
    handleSubmit,
    formState: { errors: clientErrors },
  } = useForm({
    resolver: zodResolver(
      appointmentSchema({
        startHour: bands[0].hour,
        endHour: bands[bands.length - 1].hour + 1,
        capacityPerSlot: 1,
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
          Faixa de horário{" "}
          <span className="font-normal text-brand-muted">· {dateLabel}</span>
        </legend>
        <div className="grid grid-cols-3 gap-2 md:flex md:flex-wrap">
          {bands.map((band) => {
            const taken = band.state === "taken";
            return (
              <label
                key={band.hour}
                className={`relative rounded-xl border py-2.5 text-center md:w-[112px] ${
                  taken
                    ? "cursor-not-allowed border-brand-border bg-brand-surface text-brand-faint"
                    : "cursor-pointer border-brand-border bg-brand-card text-brand-primary hover:border-brand-accent has-[:checked]:border-brand-primary has-[:checked]:bg-brand-primary has-[:checked]:text-white has-[:focus-visible]:border-brand-accent"
                }`}
              >
                {/* The control covers the card: clicking anywhere on it is
                    clicking the radio, and the radio keeps its own focus. */}
                <input
                  type="radio"
                  value={band.hour}
                  disabled={taken}
                  className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
                  {...register("slotHour")}
                />
                <span
                  className={`block text-[13px] font-bold md:text-sm ${taken ? "line-through" : ""}`}
                >
                  {band.label}
                </span>
                <span className="mt-0.5 block text-[10px] opacity-70">
                  {taken ? "ocupada" : "livre"}
                </span>
              </label>
            );
          })}
        </div>
        <FieldError message={errorFor("slotHour")} />
        <p className="mt-1.5 text-[11px] text-brand-faint">
          Faixas de uma hora: você chega em qualquer momento dela. As ocupadas
          somem quando a serventia lota o dia.
        </p>
      </fieldset>

      <div className="mt-5 flex flex-col gap-3.5">
        <div className="grid gap-3.5 md:grid-cols-2">
          <div>
            <label
              htmlFor="applicantName"
              className="mb-1.5 block text-[13px] font-semibold"
            >
              Nome completo
            </label>
            <input
              id="applicantName"
              autoComplete="name"
              className={inputClass}
              {...register("applicantName")}
            />
            <FieldError message={errorFor("applicantName")} />
          </div>

          <div>
            <label
              htmlFor="contact"
              className="mb-1.5 block text-[13px] font-semibold"
            >
              E-mail ou WhatsApp{" "}
              <span className="font-normal text-brand-muted">
                · para a confirmação
              </span>
            </label>
            <input
              id="contact"
              className={inputClass}
              placeholder="voce@exemplo.com ou (84) 90000-0000"
              {...withMask(register("contact"), formatPhone)}
            />
            <FieldError message={errorFor("contact")} />
          </div>
        </div>

        <div>
          <label
            htmlFor="subject"
            className="mb-1.5 block text-[13px] font-semibold"
          >
            Sobre o que é o atendimento{" "}
            <span className="font-normal text-brand-muted">· opcional</span>
          </label>
          <textarea
            id="subject"
            rows={3}
            className={inputClass}
            placeholder="Ex.: dúvida sobre certidão, orientação para escritura"
            {...register("subject")}
          />
          <FieldError message={errorFor("subject")} />
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
            className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent md:hidden"
            strokeWidth={1.9}
          />
          <p className="text-[12px] leading-relaxed text-brand-accent">
            Este é um <strong>pedido</strong> de horário. A serventia confirma
            ou propõe outro pelo contato acima, e você acompanha pelo protocolo{" "}
            <strong>AGD</strong>.
          </p>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="mt-3 w-full rounded-xl bg-brand-primary px-6 py-4 text-[15px] font-semibold text-white hover:bg-brand-primary-soft disabled:opacity-60 md:mt-0 md:w-auto md:shrink-0 md:px-7 md:py-3.5"
        >
          {pending ? "Enviando..." : "Pedir agendamento"}
        </button>
      </div>
    </form>
  );
}

function ConfirmationScreen({ result }: { result: AppointmentSuccess }) {
  const band = `faixa de ${result.slotHour}h às ${result.slotHour + 1}h`;

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
          Pedido de horário enviado
        </h1>
        <p className="mt-1 text-[13px] text-brand-on-dark-body">
          {formatLongDate(result.date)} · {band}
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
            Pedido de horário enviado
          </h1>
          <p className="text-[13.5px] text-brand-muted">
            {formatLongDate(result.date)} · {band}
          </p>
        </div>
      </div>

      <ProtocolReveal
        protocolNumber={result.protocolNumber}
        accessKey={result.accessKey}
        className="rounded-b-2xl md:mt-5 md:rounded-2xl"
      >
        <strong className="text-brand-alert">A chave aparece só agora.</strong>{" "}
        Guarde junto com o protocolo: é o acesso ao seu agendamento.
      </ProtocolReveal>

      <div className="mt-4 flex flex-col gap-2.5 md:grid md:grid-cols-2">
        <div className="flex gap-2.5 rounded-2xl border border-brand-border bg-brand-card p-3.5">
          <Icon
            name="clock"
            className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent"
            strokeWidth={1.9}
          />
          <div>
            <div className="text-[13.5px] font-bold text-brand-primary">
              Aguarde a confirmação
            </div>
            <p className="mt-0.5 text-[12px] leading-relaxed text-brand-muted">
              Chega pelo contato informado, normalmente no mesmo dia útil. Se a
              faixa fechar antes, a serventia propõe outra e você aceita pela
              consulta.
            </p>
          </div>
        </div>
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
      </div>

      <div className="mt-4 flex gap-2.5">
        <Link
          href={`/protocolo?numero=${encodeURIComponent(result.protocolNumber)}`}
          className="flex-1 rounded-xl bg-brand-primary px-4 py-3.5 text-center text-[13.5px] font-semibold text-white md:flex-none md:px-6"
        >
          Acompanhar pelo protocolo
        </Link>
        {/* POST, not a link: the key would otherwise sit in the address bar,
            in the browser history and in every access log on the way. */}
        <form action="/agendar/agenda" method="post" className="shrink-0">
          <input
            type="hidden"
            name="protocolNumber"
            value={result.protocolNumber}
          />
          <input type="hidden" name="accessKey" value={result.accessKey} />
          <button
            type="submit"
            className="rounded-xl border border-brand-border bg-brand-card px-4 py-3.5 text-[13.5px] font-semibold text-brand-primary md:px-6"
          >
            Adicionar à agenda
          </button>
        </form>
      </div>
    </div>
  );
}
