"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { useForm } from "react-hook-form";
import {
  DATA_RIGHT_OPTIONS,
  DATA_RIGHTS_DEADLINE_DAYS,
  dataRightOption,
  dataRightsSchema,
} from "@/core/request/channels.ts";
import { formatCpf } from "@/core/request/form.ts";
import { formatDate } from "@/core/scheduling/calendar.ts";
import { Icon } from "../_components/icon.tsx";
import { ProtocolReveal } from "../_components/protocol-reveal.tsx";
import { withMask } from "../_lib/mask.ts";
import {
  type DataRightsState,
  type DataRightsSuccess,
  submitDataRights,
} from "./actions.ts";

const inputClass =
  "w-full rounded-xl border border-brand-border bg-brand-card px-3.5 py-3 text-sm text-brand-text outline-none placeholder:text-brand-faint focus:border-brand-accent";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-xs font-semibold text-brand-alert">{message}</p>
  );
}

export interface DataRightsScreenProps {
  dpoName: string;
  dpoEmail: string;
  phone: string;
}

/**
 * The whole channel, because the confirmation replaces it: once the
 * requirement is filed, the form would only invite a second one.
 */
export function DataRightsScreen(props: DataRightsScreenProps) {
  const [state, formAction, pending] = useActionState<
    DataRightsState,
    FormData
  >(submitDataRights, { status: "idle" });
  const [attachments, setAttachments] = useState<File[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors: clientErrors },
  } = useForm({
    resolver: zodResolver(dataRightsSchema),
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

  const initials = props.dpoName
    .split(" ")
    .filter((part) => part.length > 2)
    .map((part) => part[0])
    .slice(0, 2)
    .join("");

  return (
    <div className="md:grid md:grid-cols-[1fr_320px] md:items-start md:gap-9">
      <div className="min-w-0">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-accent">
          Proteção de dados pessoais
        </span>
        <h1 className="mt-2 font-serif text-2xl font-semibold text-brand-primary md:text-3xl">
          Seus dados, seus direitos
        </h1>
        <p className="mt-1.5 max-w-[60ch] text-[13px] leading-relaxed text-brand-muted md:text-sm">
          Escolha o que você quer pedir. A serventia responde em até{" "}
          <strong>{DATA_RIGHTS_DEADLINE_DAYS} dias</strong>, como manda a Lei
          13.709/2018.
        </p>

        {/* On a phone the officer is one line above the form: present, without
            pushing the form below the fold. The full card is in the sidebar. */}
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-brand-border bg-brand-card px-3.5 py-3 md:hidden">
          <span className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-white">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-bold text-brand-primary">
              {props.dpoName}
            </div>
            <div className="truncate text-[11px] text-brand-muted">
              Encarregado de Dados (DPO) · {props.phone}
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit} noValidate className="mt-5">
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
              O que você quer pedir
            </legend>
            <div className="flex flex-col gap-2 md:grid md:grid-cols-2">
              {DATA_RIGHT_OPTIONS.map((option) => (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-brand-border bg-brand-card px-3.5 py-3 hover:border-brand-accent has-[:checked]:border-[1.5px] has-[:checked]:border-brand-primary"
                >
                  <input
                    type="radio"
                    value={option.id}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-brand-primary"
                    {...register("right")}
                  />
                  <span className="flex-1">
                    <span className="block text-[13.5px] font-bold text-brand-primary">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] text-brand-muted">
                      {option.legalName} · {option.hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <FieldError message={errorFor("right")} />
          </fieldset>

          <div className="mt-5 flex flex-col gap-3.5">
            <div className="grid gap-3.5 md:grid-cols-[1fr_1fr_200px]">
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
                  htmlFor="email"
                  className="mb-1.5 block text-[13px] font-semibold"
                >
                  E-mail
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
                  htmlFor="cpf"
                  className="mb-1.5 block text-[13px] font-semibold"
                >
                  CPF{" "}
                  <span className="font-normal text-brand-muted">
                    · opcional
                  </span>
                </label>
                <input
                  id="cpf"
                  inputMode="numeric"
                  className={inputClass}
                  placeholder="000.000.000-00"
                  {...withMask(register("cpf"), formatCpf)}
                />
                <FieldError message={errorFor("cpf")} />
              </div>
            </div>

            <div>
              <label
                htmlFor="description"
                className="mb-1.5 block text-[13px] font-semibold"
              >
                Descreva seu pedido
              </label>
              <textarea
                id="description"
                rows={4}
                className={inputClass}
                placeholder="Ex.: quero saber quais dados constam do meu cadastro"
                {...register("description")}
              />
              <FieldError message={errorFor("description")} />
            </div>

            <div>
              <label
                htmlFor="anexos"
                className="block cursor-pointer rounded-xl border-[1.5px] border-dashed border-brand-border bg-brand-card px-3 py-3.5 text-center hover:border-brand-accent has-[:focus-visible]:border-brand-accent"
              >
                <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-brand-primary">
                  <Icon name="plus" className="h-4 w-4 text-brand-accent" />
                  Anexar identidade ou procuração{" "}
                  <span className="font-normal text-brand-muted">
                    · opcional
                  </span>
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
                      className="flex items-center gap-2 rounded-lg border border-brand-border bg-brand-card px-3 py-2"
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

            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-brand-primary"
                {...register("holderDeclaration")}
              />
              <span className="text-[12px] leading-relaxed text-brand-text-soft">
                Declaro que sou o titular dos dados ou seu representante legal.
              </span>
            </label>
            <FieldError message={errorFor("holderDeclaration")} />
          </div>

          {state.status === "error" && (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-brand-alert px-3.5 py-3 text-[13px] font-semibold text-brand-alert"
            >
              {state.message}
            </p>
          )}

          <div className="mt-5 md:flex md:items-center md:gap-4">
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl bg-brand-primary px-6 py-4 text-[15px] font-semibold text-white hover:bg-brand-primary-soft disabled:opacity-60 md:w-auto md:shrink-0 md:px-7 md:py-3.5"
            >
              {pending ? "Enviando..." : "Enviar pedido ao DPO"}
            </button>
            <p className="mt-2 text-center text-[11px] text-brand-faint md:mt-0 md:text-left">
              Você recebe protocolo <strong>SOL</strong> e chave: a resposta do
              DPO fica só para você.
            </p>
          </div>
        </form>
      </div>

      <aside className="mt-6 flex flex-col gap-3.5 md:mt-9">
        <div className="hidden rounded-2xl border border-brand-border bg-brand-card p-5 md:block">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-primary text-sm font-bold text-white">
              {initials}
            </span>
            <div>
              <div className="text-[14.5px] font-bold text-brand-primary">
                {props.dpoName}
              </div>
              <div className="text-[12px] text-brand-muted">
                Encarregado pelo Tratamento de Dados (DPO)
              </div>
            </div>
          </div>
          <div className="mt-3.5 flex flex-col gap-1.5 border-t border-brand-border pt-3.5">
            <span className="text-[12.5px] font-semibold text-brand-primary-soft">
              {props.dpoEmail}
            </span>
            <span className="text-[12.5px] font-semibold text-brand-primary-soft">
              {props.phone}
            </span>
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-brand-faint">
            Atendimento conforme o art. 41, §3º, da LGPD. Você fala diretamente
            com a pessoa responsável pelos seus dados.
          </p>
        </div>

        <Link
          href="/privacidade"
          className="flex items-center gap-2.5 rounded-2xl border border-brand-border bg-brand-card px-4 py-3.5 hover:border-brand-accent"
        >
          <Icon name="file" className="h-4 w-4 shrink-0 text-brand-accent" />
          <span className="flex-1 text-[13.5px] font-bold text-brand-primary">
            Política de Privacidade
          </span>
          <Icon
            name="chevronRight"
            className="h-4 w-4 shrink-0 text-brand-primary-soft"
          />
        </Link>

        <div className="flex items-start gap-2.5 rounded-2xl bg-brand-accent-soft px-3.5 py-3">
          <Icon
            name="info"
            className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent"
            strokeWidth={2}
          />
          <p className="text-[12px] leading-relaxed text-brand-accent">
            A resposta do DPO chega pela consulta protegida por chave: ninguém
            mais lê o conteúdo do seu requerimento.
          </p>
        </div>
      </aside>
    </div>
  );
}

function ConfirmationScreen({ result }: { result: DataRightsSuccess }) {
  const option = dataRightOption(result.right);

  return (
    <div className="md:mx-auto md:max-w-3xl">
      <div className="rounded-t-2xl bg-brand-primary px-5 py-6 text-center md:hidden">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary-soft">
          <Icon
            name="lock"
            className="h-6 w-6 text-brand-on-dark-accent"
            strokeWidth={2.2}
          />
        </span>
        <h1 className="mt-3 font-serif text-[23px] font-semibold text-white">
          Pedido registrado no canal LGPD
        </h1>
        <p className="mt-1 text-[13px] text-brand-on-dark-body">
          {option.summary} · enviado ao DPO
        </p>
      </div>

      <div className="hidden items-center gap-4 md:flex">
        <span className="inline-flex h-13 w-13 shrink-0 items-center justify-center rounded-full bg-brand-primary-soft">
          <Icon
            name="lock"
            className="h-6.5 w-6.5 text-brand-on-dark-accent"
            strokeWidth={2.2}
          />
        </span>
        <div>
          <h1 className="font-serif text-[28px] font-semibold text-brand-primary">
            Pedido registrado no canal LGPD
          </h1>
          <p className="text-[13.5px] text-brand-muted">
            {option.summary} · enviado ao Encarregado de Dados
          </p>
        </div>
      </div>

      <div className="md:mt-5 md:grid md:grid-cols-[1.15fr_0.85fr] md:items-start md:gap-3.5">
        <div>
          <ProtocolReveal
            protocolNumber={result.protocolNumber}
            accessKey={result.accessKey}
            className="rounded-b-2xl md:rounded-2xl"
          >
            <strong className="text-brand-alert">
              A chave aparece só agora.
            </strong>{" "}
            É com ela que você lê a resposta do DPO: ninguém mais tem acesso ao
            conteúdo.
          </ProtocolReveal>

          <div className="mt-3.5 flex gap-2.5">
            <Link
              href={`/protocolo?numero=${encodeURIComponent(result.protocolNumber)}`}
              className="flex-1 rounded-xl bg-brand-primary px-4 py-3.5 text-center text-[13.5px] font-semibold text-white md:flex-none md:px-6"
            >
              Acompanhar pelo protocolo
            </Link>
            {/* POST, not a link: the key would otherwise sit in the address
                bar, in the browser history and in every access log. */}
            <form action="/lgpd/recibo" method="post" className="shrink-0">
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
                Baixar recibo
              </button>
            </form>
          </div>
        </div>

        <div className="mt-3.5 flex flex-col gap-2.5 md:mt-0">
          <div className="rounded-2xl border border-brand-border bg-brand-card p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-accent-soft">
                <Icon
                  name="clock"
                  className="h-4.5 w-4.5 text-brand-accent"
                  strokeWidth={1.9}
                />
              </span>
              <div>
                <div className="text-[13.5px] font-bold text-brand-primary">
                  Resposta até {formatDate(result.deadline)}
                </div>
                <div className="text-[11.5px] text-brand-muted">
                  Prazo legal de {DATA_RIGHTS_DEADLINE_DAYS} dias, contado de
                  hoje
                </div>
              </div>
            </div>
            {/* Day one of fifteen, drawn: a date alone does not say how much
                of the term is left. */}
            <div className="mt-3 flex gap-0.5">
              <span className="h-1.5 flex-1 rounded-full bg-brand-accent" />
              <span className="h-1.5 flex-[14] rounded-full bg-brand-tint" />
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-brand-faint">
              Dia 1 de {DATA_RIGHTS_DEADLINE_DAYS}. Quando o DPO responder, o
              texto aparece na consulta do protocolo e um aviso vai ao e-mail
              informado.
            </p>
          </div>

          <div className="flex gap-2.5 rounded-2xl border border-brand-border bg-brand-card p-3.5">
            <Icon
              name="shield"
              className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent"
              strokeWidth={1.9}
            />
            <div>
              <div className="text-[13.5px] font-bold text-brand-primary">
                Pode ser pedida uma comprovação
              </div>
              <p className="mt-0.5 text-[12px] leading-relaxed text-brand-muted">
                Se houver dúvida sobre a titularidade, o DPO pede um documento
                pela própria consulta.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
