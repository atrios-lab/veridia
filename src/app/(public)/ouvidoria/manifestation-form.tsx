"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { useForm } from "react-hook-form";
import {
  MANIFESTATION_OPTIONS,
  manifestationLabel,
  ombudsmanSchema,
} from "@/core/request/channels.ts";
import type { ManifestationType } from "@/core/request/kinds.ts";
import { Icon, type IconName } from "../_components/icon.tsx";
import { ProtocolReveal } from "../_components/protocol-reveal.tsx";
import {
  type OmbudsmanState,
  type OmbudsmanSuccess,
  submitManifestation,
} from "./actions.ts";

const inputClass =
  "w-full rounded-xl border border-brand-border bg-brand-surface px-3.5 py-3 text-sm text-brand-text outline-none placeholder:text-brand-faint focus:border-brand-accent";

const TYPE_ICONS: Record<ManifestationType, IconName> = {
  praise: "thumbsUp",
  complaint: "chat",
  suggestion: "bulb",
  report: "alert",
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-xs font-semibold text-brand-alert">{message}</p>
  );
}

const GUARANTEES = [
  ["lock", "Pode ser anônima: nome e contato são opcionais"],
  ["shield", "Sigilo garantido em toda a tramitação"],
  ["chat", "Resposta pelos canais oficiais"],
] as const;

function Guarantees({ className }: { className?: string }) {
  return (
    <div
      className={`flex flex-col gap-2.5 rounded-2xl bg-brand-tint px-3.5 py-3 ${className ?? ""}`}
    >
      {GUARANTEES.map(([icon, text]) => (
        <div key={text} className="flex items-center gap-2.5">
          <Icon
            name={icon}
            className="h-4 w-4 shrink-0 text-brand-primary-soft"
            strokeWidth={1.9}
          />
          <span className="text-[12px] font-semibold text-brand-primary">
            {text}
          </span>
        </div>
      ))}
    </div>
  );
}

/** The whole channel: the confirmation takes the place of the form. */
export function ManifestationScreen() {
  const [state, formAction, pending] = useActionState<OmbudsmanState, FormData>(
    submitManifestation,
    { status: "idle" },
  );
  const [attachments, setAttachments] = useState<File[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors: clientErrors },
  } = useForm({
    resolver: zodResolver(ombudsmanSchema),
    mode: "onTouched",
  });

  if (state.status === "success") return <ConfirmationScreen result={state} />;

  const serverErrors = state.status === "error" ? state.fieldErrors : {};
  const errorFor = (name: string) =>
    (clientErrors[name as keyof typeof clientErrors]?.message as
      | string
      | undefined) ?? serverErrors[name];

  const onSubmit = handleSubmit((_data, event) => {
    const form = event?.target as HTMLFormElement;
    startTransition(() => formAction(new FormData(form)));
  });

  return (
    <div className="md:grid md:grid-cols-[320px_1fr] md:items-start md:gap-9">
      <div className="min-w-0">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-accent">
          Fale com a serventia
        </span>
        <h1 className="mt-2 font-serif text-2xl font-semibold text-brand-primary md:text-3xl">
          O que você quer nos dizer?
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-brand-muted">
          Toda manifestação recebe número de registro e vai ao responsável.
        </p>
        {/* Before the first field, on every width: whether it can be anonymous
            is what decides if the person writes at all. */}
        <Guarantees className="mt-4" />
      </div>

      <form
        onSubmit={onSubmit}
        noValidate
        className="mt-5 md:mt-0 md:rounded-3xl md:border md:border-brand-border md:bg-brand-card md:p-6"
      >
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
            Tipo de manifestação
          </legend>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {MANIFESTATION_OPTIONS.map((option) => (
              <label
                key={option.id}
                className="relative cursor-pointer rounded-2xl border border-brand-border bg-brand-card px-3.5 py-3 hover:border-brand-accent has-[:checked]:border-[1.5px] has-[:checked]:border-brand-primary has-[:focus-visible]:border-brand-accent md:bg-brand-surface"
              >
                {/* The control covers the card, so clicking the icon or the
                    label is clicking the radio. */}
                <input
                  type="radio"
                  value={option.id}
                  className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
                  {...register("manifestationType")}
                />
                <Icon
                  name={TYPE_ICONS[option.id]}
                  className="h-4.5 w-4.5 text-brand-accent"
                />
                <span className="mt-1.5 block text-[13.5px] font-bold text-brand-primary">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
          <FieldError message={errorFor("manifestationType")} />
        </fieldset>

        <div className="mt-4 flex flex-col gap-3.5">
          <div>
            <label
              htmlFor="message"
              className="mb-1.5 block text-[13px] font-semibold"
            >
              Sua mensagem
            </label>
            <textarea
              id="message"
              rows={5}
              className={inputClass}
              placeholder="Conte o que aconteceu, com data e horário se lembrar."
              {...register("message")}
            />
            <FieldError message={errorFor("message")} />
          </div>

          <div className="grid gap-3.5 md:grid-cols-2">
            <div>
              <label
                htmlFor="applicantName"
                className="mb-1.5 block text-[13px] font-semibold"
              >
                Nome{" "}
                <span className="font-normal text-brand-muted">· opcional</span>
              </label>
              <input
                id="applicantName"
                className={inputClass}
                placeholder="deixe em branco para ser anônima"
                {...register("applicantName")}
              />
              <FieldError message={errorFor("applicantName")} />
            </div>
            <div>
              <label
                htmlFor="contact"
                className="mb-1.5 block text-[13px] font-semibold"
              >
                Contato{" "}
                <span className="font-normal text-brand-muted">· opcional</span>
              </label>
              <input
                id="contact"
                className={inputClass}
                placeholder="para receber resposta"
                {...register("contact")}
              />
              <FieldError message={errorFor("contact")} />
            </div>
          </div>

          <div>
            <label
              htmlFor="anexos"
              className="block cursor-pointer rounded-xl border-[1.5px] border-dashed border-brand-border px-3 py-3.5 text-center hover:border-brand-accent has-[:focus-visible]:border-brand-accent"
            >
              <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-brand-primary">
                <Icon name="plus" className="h-4 w-4 text-brand-accent" />
                Anexar foto ou documento{" "}
                <span className="font-normal text-brand-muted">· opcional</span>
              </span>
              <input
                id="anexos"
                name="anexos"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                className="sr-only"
                onChange={(event) =>
                  setAttachments([...(event.target.files ?? [])])
                }
              />
            </label>
            {attachments.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1.5">
                {attachments.map((file) => (
                  <li
                    key={`${file.name}-${file.lastModified}`}
                    className="flex items-center gap-2 rounded-lg border border-brand-border bg-brand-surface px-3 py-2"
                  >
                    <Icon
                      name="file"
                      className="h-4 w-4 shrink-0 text-brand-accent"
                    />
                    <span className="truncate text-[12.5px] text-brand-text">
                      {file.name}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Secrecy is not anonymity, and the difference decides what the
              office can do for the person. */}
          <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-brand-border bg-brand-surface px-3.5 py-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-brand-primary"
              {...register("confidential")}
            />
            <span>
              <span className="block text-[13px] font-semibold text-brand-primary">
                Manter minha identidade em sigilo
              </span>
              <span className="mt-0.5 block text-[11.5px] leading-relaxed text-brand-muted">
                Você se identifica para a serventia responder, mas seu nome não
                circula na tramitação.
              </span>
            </span>
          </label>
        </div>

        {state.status === "error" && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-brand-alert px-3.5 py-3 text-[13px] font-semibold text-brand-alert"
          >
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-5 w-full rounded-xl bg-brand-primary px-6 py-4 text-[15px] font-semibold text-white hover:bg-brand-primary-soft disabled:opacity-60 md:w-auto md:px-7 md:py-3.5"
        >
          {pending ? "Enviando..." : "Registrar manifestação"}
        </button>
        <p className="mt-2 text-center text-[11px] text-brand-faint md:text-left">
          Toda manifestação recebe número de registro e vai ao responsável.
        </p>
      </form>
    </div>
  );
}

function ConfirmationScreen({ result }: { result: OmbudsmanSuccess }) {
  const summary = result.anonymous
    ? "enviada de forma anônima"
    : result.confidential
      ? "identificada, com pedido de sigilo"
      : "identificada";

  return (
    <div className="md:mx-auto md:max-w-3xl">
      <div className="rounded-t-2xl bg-brand-primary px-5 py-6 text-center md:hidden">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary-soft">
          <Icon
            name="chat"
            className="h-6 w-6 text-brand-on-dark-accent"
            strokeWidth={2.2}
          />
        </span>
        <h1 className="mt-3 font-serif text-[23px] font-semibold text-white">
          Manifestação registrada
        </h1>
        <p className="mt-1 text-[13px] text-brand-on-dark-body">
          {manifestationLabel(result.manifestationType)} · {summary}
        </p>
      </div>

      <div className="hidden items-center gap-4 md:flex">
        <span className="inline-flex h-13 w-13 shrink-0 items-center justify-center rounded-full bg-brand-primary-soft">
          <Icon
            name="chat"
            className="h-6.5 w-6.5 text-brand-on-dark-accent"
            strokeWidth={2.2}
          />
        </span>
        <div>
          <h1 className="font-serif text-[28px] font-semibold text-brand-primary">
            Manifestação registrada
          </h1>
          <p className="text-[13.5px] text-brand-muted">
            {manifestationLabel(result.manifestationType)} · {summary}
          </p>
        </div>
      </div>

      <div className="md:mt-5 md:grid md:grid-cols-[1.15fr_0.85fr] md:items-start md:gap-3.5">
        <div>
          <ProtocolReveal
            protocolNumber={result.protocolNumber}
            accessKey={result.accessKey}
            protocolLabel="Número de registro"
            className="rounded-b-2xl md:rounded-2xl"
          >
            {result.anonymous ? (
              <>
                Como você não se identificou, <strong>não existe chave</strong>:
                não há dados seus para proteger, e a serventia não tem como
                responder diretamente. O registro entra na fila do responsável
                do mesmo jeito.
              </>
            ) : (
              <>
                <strong className="text-brand-alert">
                  A chave aparece só agora.
                </strong>{" "}
                {result.confidential
                  ? "Você pediu sigilo: seu nome fica visível apenas para o responsável da ouvidoria e não circula na tramitação. A resposta chega pela consulta protegida por esta chave."
                  : "É com ela que você acompanha a manifestação e lê a resposta da ouvidoria."}
              </>
            )}
          </ProtocolReveal>

          <div className="mt-3.5 flex gap-2.5">
            {result.accessKey ? (
              <Link
                href={`/protocolo?numero=${encodeURIComponent(result.protocolNumber)}`}
                className="flex-1 rounded-xl bg-brand-primary px-4 py-3.5 text-center text-[13.5px] font-semibold text-white md:flex-none md:px-6"
              >
                Acompanhar pelo registro
              </Link>
            ) : (
              <Link
                href="/"
                className="flex-1 rounded-xl bg-brand-primary px-4 py-3.5 text-center text-[13.5px] font-semibold text-white md:flex-none md:px-6"
              >
                Voltar ao início
              </Link>
            )}
            <Link
              href="/ouvidoria"
              className="shrink-0 rounded-xl border border-brand-border bg-brand-card px-4 py-3.5 text-center text-[13.5px] font-semibold text-brand-primary md:px-6"
            >
              Nova manifestação
            </Link>
          </div>
        </div>

        <div className="mt-3.5 rounded-2xl border border-brand-border bg-brand-card p-4 md:mt-0">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-accent">
            O que acontece agora
          </span>
          <ol className="mt-2.5 flex flex-col gap-2.5">
            {(result.anonymous
              ? [
                  "Guarde o número de registro: serve para citar esta manifestação se você voltar a falar com a serventia.",
                  "Quer resposta? Registre de novo com um contato, ou peça sigilo em vez de anonimato: aí você se identifica só para a serventia.",
                ]
              : [
                  "O responsável da ouvidoria recebe e analisa a manifestação.",
                  "Se precisar, entra em contato pelo canal que você informou.",
                  "A resposta fica na consulta, com o histórico do tratamento.",
                ]
            ).map((line, index) => (
              <li key={line} className="flex gap-2.5">
                <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[11.5px] font-bold text-brand-primary">
                  {index + 1}
                </span>
                <p className="text-[12.5px] leading-relaxed text-brand-text-soft">
                  {line}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
