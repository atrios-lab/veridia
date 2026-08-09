"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { startTransition, useActionState, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { Act } from "@/core/acts/catalog.ts";
import { ATTRIBUTION_SHORT_NAMES } from "@/core/acts/catalog.ts";
import { MAX_ATTACHMENTS } from "@/core/request/attachment.ts";
import {
  formatCpf,
  formatPhone,
  serviceRequestSchema,
} from "@/core/request/form.ts";
import type { Attribution } from "@/core/tenant/schema.ts";
import { Icon } from "../_components/icon.tsx";
import { ProtocolReveal } from "../_components/protocol-reveal.tsx";
import { withMask } from "../_lib/mask.ts";
import { ProcessingBadge } from "./_components/badges.tsx";
import {
  type AttachState,
  attachSignedForm,
  type SubmitState,
  type SubmitSuccess,
  submitServiceRequest,
} from "./actions.ts";

const PARAMETER_LABELS = {
  transactionValue: "Valor da transação ou do documento",
  registryYears: "Há quantos anos o registro foi feito",
} as const;

const inputClass =
  "w-full rounded-xl border border-brand-border bg-brand-card px-3.5 py-3 text-sm text-brand-text outline-none placeholder:text-brand-faint focus:border-brand-accent";

function DocumentsChecklist({ documents }: { documents: string[] }) {
  return (
    <ul className="mt-2.5 flex flex-col gap-2">
      {documents.map((document) => (
        <li
          key={document}
          className="flex items-center gap-2 text-[12.5px] text-brand-text-soft"
        >
          <span className="h-4 w-4 shrink-0 rounded border-[1.5px] border-brand-border" />
          {document}
        </li>
      ))}
    </ul>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-xs font-semibold text-brand-alert">{message}</p>
  );
}

export function RequestForm({
  act,
  attribution,
}: {
  act: Act;
  attribution: Attribution;
}) {
  const [state, formAction, pending] = useActionState<SubmitState, FormData>(
    submitServiceRequest,
    { status: "idle" },
  );
  // The native file input is visually hidden (the dashed box is the control),
  // so the feedback it used to give has to come from somewhere.
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function removeAttachment(index: number) {
    const next = attachments.filter((_, i) => i !== index);
    setAttachments(next);
    // The form posts the input's own FileList, so it has to be rebuilt too,
    // not just the state that renders the list.
    const transfer = new DataTransfer();
    for (const file of next) transfer.items.add(file);
    if (fileInputRef.current) fileInputRef.current.files = transfer.files;
  }

  const {
    register,
    handleSubmit,
    formState: { errors: clientErrors },
  } = useForm({
    resolver: zodResolver(serviceRequestSchema(act)),
    mode: "onTouched",
  });

  if (state.status === "success") {
    return <SuccessScreen result={state} />;
  }

  // The client catches what the schema can; the server can still refuse
  // (attachments, rate limit) and its per-field errors land here too.
  const serverErrors = state.status === "error" ? state.fieldErrors : {};
  const errorFor = (name: keyof typeof clientErrors & string) =>
    (clientErrors[name]?.message as string | undefined) ?? serverErrors[name];

  // Validation gates the send; the untouched FormData (honeypot and
  // attachments included) still goes to the same server action.
  const onSubmit = handleSubmit((_data, event) => {
    const form = event?.target as HTMLFormElement;
    startTransition(() => formAction(new FormData(form)));
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="mt-5 md:grid md:grid-cols-[1fr_340px] md:gap-9"
    >
      <input type="hidden" name="actId" value={act.id} />

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

      <div className="flex flex-col gap-3.5">
        <ActContext act={act} attribution={attribution} className="md:hidden" />

        {/* Desktop pairs name and contact and narrows the CPF, as the
            redesign draws; on a phone everything stacks. */}
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
                · para retorno
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

        <div className="md:max-w-[280px]">
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
            {...withMask(register("cpf"), formatCpf)}
          />
          <FieldError message={errorFor("cpf")} />
        </div>

        <div>
          <label
            htmlFor="description"
            className="mb-1.5 block text-[13px] font-semibold"
          >
            Descreva o que você precisa
            {!act.requiresDescription && (
              <span className="font-normal text-brand-muted"> · opcional</span>
            )}
          </label>
          <textarea
            id="description"
            rows={4}
            className={inputClass}
            placeholder="Ex.: queremos casar em outubro deste ano."
            {...register("description")}
          />
          <FieldError message={errorFor("description")} />
        </div>

        {/* Only the acts the law lets ask. A certificate may never require it
            (Lei 6.015 art. 17), so the field is not even rendered. */}
        {act.requiresPurpose && (
          <div>
            <label
              htmlFor="purpose"
              className="mb-1.5 block text-[13px] font-semibold"
            >
              Finalidade
            </label>
            <input
              id="purpose"
              className={inputClass}
              placeholder="Para que a certidão será usada"
              {...register("purpose")}
            />
            <FieldError message={errorFor("purpose")} />
          </div>
        )}

        {act.parameter && (
          <div>
            <label
              htmlFor="parameterValue"
              className="mb-1.5 block text-[13px] font-semibold"
            >
              {PARAMETER_LABELS[act.parameter]}
            </label>
            <input
              id="parameterValue"
              className={inputClass}
              {...register("parameterValue")}
            />
            <p className="mt-1.5 text-[11px] text-brand-faint">
              Serve para a serventia localizar a faixa correta na tabela de
              custas. O site não calcula valores.
            </p>
            <FieldError message={errorFor("parameterValue")} />
          </div>
        )}

        {/* On a phone the checklist sits with the upload; on desktop it moves
            to the sidebar, next to the act, the way the redesign draws it. */}
        <div className="rounded-2xl border border-brand-border bg-brand-card p-4">
          <div className={act.documents ? "md:hidden" : undefined}>
            <div className="text-[13px] font-bold text-brand-primary">
              Documentos para este ato
            </div>
            {act.documents ? (
              <DocumentsChecklist documents={act.documents} />
            ) : (
              <p className="mt-2 text-[12.5px] text-brand-muted">
                Este ato não tem lista fixa. Anexe o que ajudar a serventia a
                entender o pedido.
              </p>
            )}
          </div>

          <label
            htmlFor="anexos"
            className={`block cursor-pointer rounded-xl border-[1.5px] border-dashed border-brand-border px-3 py-3.5 text-center hover:border-brand-accent has-[:focus-visible]:border-brand-accent ${act.documents ? "mt-3 md:mt-0" : "mt-3"}`}
          >
            <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-brand-primary">
              <Icon name="plus" className="h-4 w-4 text-brand-accent" />
              <span className="md:hidden">Tirar foto ou anexar arquivo</span>
              <span className="hidden md:inline">
                Anexar arquivos{" "}
                <span className="font-normal text-brand-muted">
                  · até {MAX_ATTACHMENTS}, foto ou PDF
                </span>
              </span>
            </span>
            {/* Hidden, not gone: the dashed box is the visible control, and
                the input keeps working for keyboard, screen reader and the
                form post. */}
            <input
              ref={fileInputRef}
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
            <ul className="mt-2.5 flex flex-col gap-2">
              {attachments.map((file, index) => (
                <li
                  key={`${file.name}-${file.lastModified}`}
                  className="flex items-center gap-2 rounded-lg border border-brand-border bg-brand-card px-3 py-2"
                >
                  <Icon
                    name="file"
                    className="h-4 w-4 shrink-0 text-brand-accent"
                  />
                  <span className="flex-1 truncate text-[12.5px] text-brand-text">
                    {file.name}
                  </span>
                  <span className="shrink-0 text-[11px] text-brand-faint">
                    {formatFileSize(file.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="shrink-0 text-brand-faint hover:text-brand-alert"
                    aria-label={`Remover ${file.name}`}
                  >
                    <Icon name="x" className="h-4 w-4" strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-brand-faint">
            Até {MAX_ATTACHMENTS} arquivos (foto ou PDF). Pode enviar depois,
            pela consulta do protocolo.
          </p>
        </div>

        {act.guidance && (
          <div className="flex items-start gap-2.5 rounded-2xl bg-brand-accent-soft px-3.5 py-3">
            <Icon
              name="info"
              className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent"
              strokeWidth={2}
            />
            <p className="text-[12px] leading-relaxed text-brand-accent">
              {act.guidance} O pedido enviado aqui adianta a análise.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-brand-primary"
              {...register("lgpdConsent")}
            />
            <span className="text-[12px] leading-relaxed text-brand-text-soft">
              Autorizo o tratamento dos meus dados para a análise e a prática do
              ato (Lei 13.709/2018, LGPD).
            </span>
          </label>
          <FieldError message={errorFor("lgpdConsent")} />
          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-brand-primary"
              {...register("truthDeclaration")}
            />
            <span className="text-[12px] leading-relaxed text-brand-text-soft">
              Declaro, sob as penas da lei, que as informações são verdadeiras.
            </span>
          </label>
          <FieldError message={errorFor("truthDeclaration")} />
        </div>

        {state.status === "error" && (
          <p
            role="alert"
            className="rounded-xl border border-brand-alert px-3.5 py-3 text-[13px] font-semibold text-brand-alert"
          >
            {state.message}
          </p>
        )}

        <div className="md:flex md:items-center md:gap-4">
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-brand-primary px-6 py-4 text-[15px] font-semibold text-white hover:bg-brand-primary-soft disabled:opacity-60 md:w-auto md:shrink-0 md:px-7 md:py-3.5"
          >
            {pending ? "Enviando..." : "Enviar requerimento"}
          </button>
          <p className="mt-2 text-[11px] text-brand-faint md:mt-0 md:max-w-[40ch]">
            Pagamentos e emissão do ato acontecem na serventia. Sem CAPTCHA: a
            proteção anti-robô é invisível.
          </p>
        </div>
      </div>

      <aside className="mt-6 flex flex-col gap-3.5 md:mt-0">
        <ActContext
          act={act}
          attribution={attribution}
          className="hidden md:block"
        />
        {act.documents && (
          <div className="hidden rounded-2xl border border-brand-border bg-brand-card p-4 md:block">
            <div className="text-[13px] font-bold text-brand-primary">
              Documentos para este ato
            </div>
            <DocumentsChecklist documents={act.documents} />
            <p className="mt-2.5 text-[11.5px] text-brand-faint">
              Pode anexar agora ou depois, pela consulta do protocolo.
            </p>
          </div>
        )}
        <div className="flex items-start gap-2.5 rounded-2xl bg-brand-accent-soft px-3.5 py-3">
          <Icon
            name="info"
            className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent"
            strokeWidth={2}
          />
          <p className="text-[12px] leading-relaxed text-brand-accent">
            Ao enviar, você recebe um <strong>protocolo</strong> e uma{" "}
            <strong>chave de acesso</strong>, mostrada uma única vez. É com eles
            que você acompanha o pedido.
          </p>
        </div>
      </aside>
    </form>
  );
}

function ActContext({
  act,
  attribution,
  className,
}: {
  act: Act;
  attribution: Attribution;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-l-4 border-brand-border border-l-brand-accent bg-brand-card p-3.5 ${className ?? ""}`}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex-1">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-brand-accent">
            {ATTRIBUTION_SHORT_NAMES[attribution]}
          </div>
          <div className="font-serif text-[15px] font-semibold text-brand-primary">
            {act.name}
          </div>
        </div>
        <Link
          href={`/solicitar?atribuicao=${attribution}`}
          className="text-xs font-semibold text-brand-primary-soft underline"
        >
          trocar
        </Link>
      </div>
      <div className="mt-2">
        <ProcessingBadge mode={act.processingMode} />
      </div>
    </div>
  );
}

function SuccessScreen({ result }: { result: SubmitSuccess }) {
  const [attachState, attachAction, attaching] = useActionState<
    AttachState,
    FormData
  >(attachSignedForm, { status: "idle" });

  return (
    <div className="mt-5 md:mx-auto md:max-w-3xl">
      <div className="rounded-t-2xl bg-brand-primary px-5 py-6 text-center">
        <span className="inline-flex h-13 w-13 items-center justify-center rounded-full bg-brand-primary-soft">
          <Icon
            name="check"
            className="h-6.5 w-6.5 text-brand-on-dark-accent"
            strokeWidth={2.4}
          />
        </span>
        <h1 className="mt-3 font-serif text-[23px] font-semibold text-white">
          Pedido registrado
        </h1>
        <p className="mt-1 text-[13px] text-brand-on-dark-body">
          {result.actName} · {result.attributionName}
        </p>
      </div>

      {/* The key is the loudest thing on the screen because this is the only
          moment it exists. Nothing here can bring it back. */}
      <ProtocolReveal
        protocolNumber={result.protocolNumber}
        accessKey={result.accessKey}
        className="rounded-b-2xl"
      >
        <strong className="text-brand-alert">A chave aparece só agora.</strong>{" "}
        O site não guarda nem reenvia. Ela também vai impressa no PDF do
        requerimento.
      </ProtocolReveal>

      <ol className="mt-4 flex flex-col gap-2.5">
        <Step number={1} title="Guarde o protocolo e a chave">
          <p className="text-[12px] leading-relaxed text-brand-muted">
            Eles dão acesso ao andamento e aos documentos em{" "}
            <strong>Consultar protocolo</strong>.
          </p>
        </Step>

        <Step number={2} title="Baixe o requerimento e assine">
          <p className="text-[12px] leading-relaxed text-brand-muted">
            Digitalmente pelo Gov.br (assinador.iti.br), ou imprima e assine de
            próprio punho.
          </p>
          {/* POST, not a link: the key would otherwise sit in the address bar,
              in the browser history and in every access log on the way. */}
          <form
            action="/solicitar/requerimento"
            method="post"
            className="mt-2.5"
          >
            <input
              type="hidden"
              name="protocolNumber"
              value={result.protocolNumber}
            />
            <input type="hidden" name="accessKey" value={result.accessKey} />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-3.5 py-2.5 text-[12.5px] font-semibold text-white hover:bg-brand-primary-soft"
            >
              <Icon name="download" className="h-3.5 w-3.5" strokeWidth={2} />
              Baixar requerimento (PDF)
            </button>
          </form>
        </Step>

        <Step number={3} title="Envie o requerimento assinado">
          <p className="text-[12px] leading-relaxed text-brand-muted">
            Aqui, agora, ou depois pela consulta, ou em papel no balcão. O
            pedido não trava.
          </p>
          <form action={attachAction} className="mt-2.5">
            <input
              type="hidden"
              name="protocolNumber"
              value={result.protocolNumber}
            />
            <input type="hidden" name="accessKey" value={result.accessKey} />
            {/* One gesture, like the redesign draws it: picking the file is
                the send. The input is hidden but keeps working for keyboard
                and screen reader; the dashed box is the visible control. */}
            <label
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-dashed border-brand-border px-3 py-2.5 text-[12.5px] font-semibold text-brand-primary hover:border-brand-accent has-[:focus-visible]:border-brand-accent ${attaching ? "opacity-60" : ""}`}
            >
              <Icon name="plus" className="h-3.5 w-3.5 text-brand-accent" />
              {attaching ? "Enviando..." : "Anexar requerimento assinado"}
              <input
                type="file"
                name="requerimento"
                accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                className="sr-only"
                disabled={attaching}
                onChange={(event) => {
                  if (event.target.files?.length) {
                    event.target.form?.requestSubmit();
                  }
                }}
              />
            </label>
            {attachState.status !== "idle" && (
              <output
                className={`mt-2 block text-[12px] font-semibold ${
                  attachState.status === "error"
                    ? "text-brand-alert"
                    : "text-brand-primary-soft"
                }`}
              >
                {attachState.message}
              </output>
            )}
          </form>
        </Step>
      </ol>

      <div className="mt-4 flex gap-2.5">
        <Link
          href={`/protocolo?numero=${encodeURIComponent(result.protocolNumber)}`}
          className="flex-1 rounded-xl bg-brand-primary px-4 py-3.5 text-center text-[13.5px] font-semibold text-white"
        >
          Acompanhar pedido
        </Link>
        <Link
          href="/solicitar"
          className="flex-1 rounded-xl border border-brand-border bg-brand-card px-4 py-3.5 text-center text-[13.5px] font-semibold text-brand-primary"
        >
          Novo pedido
        </Link>
      </div>
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3 rounded-2xl border border-brand-border bg-brand-card p-3.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-tint text-xs font-bold text-brand-primary">
        {number}
      </span>
      <div className="flex-1">
        <div className="text-[13.5px] font-bold text-brand-primary">
          {title}
        </div>
        {children}
      </div>
    </li>
  );
}
