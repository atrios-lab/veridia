"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import {
  DATA_RIGHT_OPTIONS,
  DATA_RIGHTS_DEADLINE_DAYS,
  manifestationLabel,
} from "@/core/request/channels.ts";
import { formatShortDate } from "@/core/scheduling/calendar.ts";
import { Icon } from "../_components/icon.tsx";
import { ProtocolSearchButton } from "../_components/protocol-search-button.tsx";
import { type AttachState, attachSignedForm } from "../solicitar/actions.ts";
import {
  type AcceptProposalState,
  type AppointmentDetail,
  type AttachDocumentState,
  acceptProposedSlot,
  attachExtraDocument,
  type DataRightsDetail,
  type FulfillRequirementState,
  fulfillRequirementAction,
  type LookupState,
  lookupProtocolDetail,
  type OmbudsmanDetail,
  type RequirementView,
  type ServiceRequestDetail,
} from "./actions.ts";

export interface PublicStatus {
  protocolNumber: string;
  typeLabel: string;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
}

interface Contacts {
  phone: string;
  whatsapp: string;
}

const inputClass =
  "w-full rounded-xl border border-brand-border bg-brand-surface px-3.5 py-3 text-sm text-brand-text outline-none placeholder:text-brand-faint focus:border-brand-accent";

const digits = (value: string) => value.replace(/\D/g, "");

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function LostKeyNotice({ contacts }: { contacts: Contacts }) {
  return (
    <div className="flex items-start gap-2 pt-2.5">
      <Icon
        name="alert"
        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-alert"
        strokeWidth={2}
      />
      <span className="text-[12px] leading-relaxed text-brand-text-soft">
        Perdeu a chave? A serventia emite outra pelo{" "}
        <a
          href={`https://wa.me/55${digits(contacts.whatsapp)}`}
          className="font-semibold underline"
        >
          WhatsApp
        </a>{" "}
        ou{" "}
        <a
          href={`tel:+55${digits(contacts.phone)}`}
          className="font-semibold underline"
        >
          telefone
        </a>
        .
      </span>
    </div>
  );
}

export function ProtocolLookup({
  tenantName,
  initialNumber,
  publicStatus,
  notFound,
  contacts,
}: {
  tenantName: string;
  initialNumber?: string;
  publicStatus?: PublicStatus;
  notFound: boolean;
  contacts: Contacts;
}) {
  const [state, formAction, pending] = useActionState<LookupState, FormData>(
    lookupProtocolDetail,
    { status: "idle" },
  );

  if (state.status === "success") {
    switch (state.kind) {
      case "appointment":
        return <AppointmentCard result={state} contacts={contacts} />;
      case "data-rights":
        return <DataRightsCard result={state} />;
      case "ombudsman":
        return <OmbudsmanCard result={state} />;
      default:
        return <RequestDetail result={state} contacts={contacts} />;
    }
  }

  // A result (or an error) earns the right column: the desktop frame pairs
  // the search with an answer, side by side. With nothing to answer yet, a
  // lone wide column reads emptier than a column sized to the search itself.
  const hasResult = notFound || Boolean(publicStatus);

  return (
    <div
      className={
        hasResult
          ? "md:grid md:grid-cols-[1fr_460px] md:items-start md:gap-10"
          : "md:max-w-xl"
      }
    >
      <div className="flex flex-col gap-4 md:gap-5">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-brand-accent">
            {tenantName}
          </span>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-brand-primary">
            Consultar protocolo
          </h1>
          <p className="mt-3 max-w-xl leading-relaxed text-brand-muted md:max-w-[42ch]">
            Campo único para pedido de serviço, agendamento, LGPD ou ouvidoria.
            Sem a chave você vê o andamento; com ela, o detalhe completo e os
            documentos.
          </p>
        </div>

        <form
          action="/protocolo"
          method="get"
          className="rounded-2xl border border-brand-border bg-brand-card p-4 md:rounded-none md:border-0 md:bg-transparent md:p-0"
        >
          <label
            htmlFor="numero"
            className="mb-1.5 block text-[13px] font-semibold text-brand-primary md:hidden"
          >
            Número do protocolo
          </label>
          <p className="mb-2.5 text-[12.5px] leading-relaxed text-brand-muted md:hidden">
            Serve para qualquer número: pedido (REQ), agendamento (AGD), LGPD
            (SOL) ou ouvidoria (OUV).
          </p>
          <div className="flex gap-1.5">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-brand-border bg-brand-surface px-3">
              <Icon
                name="search"
                className="h-4 w-4 shrink-0 text-brand-accent"
              />
              <input
                id="numero"
                name="numero"
                required
                defaultValue={initialNumber}
                placeholder="REQ.2026.000148"
                className="w-full bg-transparent py-3 text-sm text-brand-text outline-none placeholder:text-brand-faint"
              />
            </div>
            <ProtocolSearchButton className="shrink-0 rounded-xl px-4 py-3" />
          </div>
        </form>

        <div className="hidden md:block">
          <LostKeyNotice contacts={contacts} />
        </div>
      </div>

      {hasResult && (
        <div className="mt-4 flex flex-col gap-4 md:mt-0">
          {notFound && (
            <p
              role="alert"
              className="rounded-xl border border-brand-alert px-3.5 py-3 text-[13px] leading-relaxed text-brand-text-soft"
            >
              Não encontramos o protocolo{" "}
              <strong className="text-brand-alert">{initialNumber}</strong>.
              Confira o número e tente de novo.
            </p>
          )}

          {publicStatus && (
            <>
              <div className="rounded-2xl border border-brand-border bg-brand-card p-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex-1">
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">
                      {publicStatus.typeLabel}
                    </div>
                    <div className="mt-0.5 text-[17px] font-bold tracking-wide text-brand-primary">
                      {publicStatus.protocolNumber}
                    </div>
                  </div>
                  <StatusBadge label={publicStatus.statusLabel} />
                </div>
                <div className="mt-3 flex gap-4 border-t border-brand-border pt-3">
                  <div className="flex-1">
                    <div className="text-[10.5px] text-brand-faint">
                      Recebido em
                    </div>
                    <div className="text-[13px] font-semibold text-brand-text">
                      {formatDate(publicStatus.createdAt)}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-[10.5px] text-brand-faint">
                      Última atualização
                    </div>
                    <div className="text-[13px] font-semibold text-brand-text">
                      {formatDate(publicStatus.updatedAt)}
                    </div>
                  </div>
                </div>
                <p className="mt-2.5 text-[11.5px] text-brand-faint">
                  É tudo o que aparece sem a chave: nomes, documentos e valores
                  ficam protegidos.
                </p>
              </div>

              <form
                action={formAction}
                className="rounded-2xl border-[1.5px] border-brand-accent bg-brand-card p-4"
              >
                <input
                  type="hidden"
                  name="protocolNumber"
                  value={publicStatus.protocolNumber}
                />
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-xl bg-brand-accent-soft">
                    <Icon
                      name="lock"
                      className="h-4.5 w-4.5 text-brand-accent"
                    />
                  </span>
                  <div className="flex-1">
                    <div className="font-serif text-[16px] font-semibold text-brand-primary">
                      Destrave o detalhe
                    </div>
                    <div className="text-xs text-brand-muted">
                      Com a chave você vê tudo e envia documentos.
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-1.5">
                  <input
                    name="accessKey"
                    placeholder="Ex.: BBM8-6XVB-8PUK"
                    className={`${inputClass} flex-1`}
                  />
                  <button
                    type="submit"
                    disabled={pending}
                    className="shrink-0 rounded-xl bg-brand-primary px-3.5 py-3 text-sm font-semibold text-white hover:bg-brand-primary-soft disabled:opacity-60"
                  >
                    {pending ? "Verificando…" : "Ver detalhes"}
                  </button>
                </div>
                <p className="mt-2 text-[11.5px] leading-relaxed text-brand-muted">
                  A chave foi mostrada quando você enviou o pedido e está
                  impressa no PDF do requerimento.
                </p>
                {state.status === "error" && (
                  <p
                    role="alert"
                    className="mt-2 text-[12px] font-semibold text-brand-alert"
                  >
                    {state.message}
                  </p>
                )}
                <div className="border-t border-brand-border md:hidden">
                  <LostKeyNotice contacts={contacts} />
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-tint px-2.5 py-1.5 text-[11.5px] font-bold text-brand-primary-soft">
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function TimelineStep({
  done,
  label,
  detail,
  lineBelow,
}: {
  done?: boolean;
  label: string;
  detail?: string;
  lineBelow?: boolean;
}) {
  return (
    <li className="flex gap-2.5">
      <span className="flex flex-col items-center">
        <span
          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${done ? "bg-brand-accent" : "border-2 border-brand-border bg-brand-surface"}`}
        />
        {lineBelow && <span className="w-0.5 flex-1 bg-brand-border" />}
      </span>
      <div className={lineBelow ? "pb-3.5" : ""}>
        <div
          className={`text-[13px] font-semibold ${done ? "text-brand-primary" : "text-brand-faint"}`}
        >
          {label}
        </div>
        {detail && (
          <div className="text-[11.5px] text-brand-faint">{detail}</div>
        )}
      </div>
    </li>
  );
}

function RequirementRow({
  requirement,
  protocolNumber,
  accessKey,
  onFulfilled,
}: {
  requirement: RequirementView;
  protocolNumber: string;
  accessKey: string;
  onFulfilled: (id: string) => void;
}) {
  const [state, action, pending] = useActionState<
    FulfillRequirementState,
    FormData
  >(fulfillRequirementAction, { status: "idle" });

  useEffect(() => {
    if (state.status === "success") onFulfilled(requirement.id);
  }, [state, requirement.id, onFulfilled]);

  if (requirement.status === "fulfilled") {
    return (
      <div className="rounded-xl border border-brand-border bg-brand-card p-3.5 opacity-85">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-brand-primary-soft px-2.5 py-0.5 text-[10.5px] font-bold text-white">
            Cumprida
          </span>
          <span className="text-[11px] text-brand-faint">
            registrada em {formatDate(requirement.createdAt)}
            {requirement.fulfilledAt
              ? ` · resolvida em ${formatDate(requirement.fulfilledAt)}`
              : ""}
          </span>
        </div>
        <p className="mt-2 text-[13px] text-brand-text">{requirement.text}</p>
        {requirement.resolutionFileName && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-brand-primary-soft">
            <Icon name="file" className="h-3.5 w-3.5" />
            {requirement.resolutionFileName}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border-[1.5px] border-brand-accent-line bg-brand-accent-soft p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-brand-accent px-2.5 py-0.5 text-[10.5px] font-bold text-white">
          Aguardando você
        </span>
        <span className="text-[11px] text-brand-faint">
          registrada em {formatDate(requirement.createdAt)}
        </span>
      </div>
      <p className="mt-2 text-[13px] font-semibold text-brand-primary">
        {requirement.text}
      </p>
      <form action={action} className="mt-2.5">
        <input type="hidden" name="protocolNumber" value={protocolNumber} />
        <input type="hidden" name="accessKey" value={accessKey} />
        <input type="hidden" name="requirementId" value={requirement.id} />
        <label
          className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border-[1.5px] border-dashed border-brand-accent-line bg-brand-card px-3 py-2.5 text-[12px] font-semibold text-brand-primary hover:border-brand-accent ${pending ? "opacity-60" : ""}`}
        >
          <Icon name="plus" className="h-3.5 w-3.5 text-brand-accent" />
          {pending ? "Enviando..." : "Enviar resposta"}
          <input
            type="file"
            name="resposta"
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            className="sr-only"
            disabled={pending}
            onChange={(event) => {
              if (event.target.files?.length) {
                event.target.form?.requestSubmit();
              }
            }}
          />
        </label>
        {state.status === "error" && (
          <output className="mt-1.5 block text-[11.5px] font-semibold text-brand-alert">
            {state.message}
          </output>
        )}
      </form>
    </div>
  );
}

/**
 * Exigências live inside the request's own detail, not on a screen of their
 * own: the citizen cumpre one the same way they read everything else here,
 * with the protocol and key they already typed once.
 */
function RequirementsCard({ result }: { result: ServiceRequestDetail }) {
  const [requirements, setRequirements] = useState(result.requirements);
  if (requirements.length === 0) return null;

  return (
    <div className="rounded-2xl border border-brand-border bg-brand-card p-4">
      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-accent">
        Exigências
      </span>
      <div className="mt-2.5 flex flex-col gap-2.5">
        {requirements.map((requirement) => (
          <RequirementRow
            key={requirement.id}
            requirement={requirement}
            protocolNumber={result.protocolNumber}
            accessKey={result.accessKey}
            onFulfilled={(id) =>
              setRequirements((prev) =>
                prev.map((r) =>
                  r.id === id
                    ? {
                        ...r,
                        status: "fulfilled",
                        fulfilledAt: new Date().toISOString(),
                      }
                    : r,
                ),
              )
            }
          />
        ))}
      </div>
    </div>
  );
}

function RequestDetail({
  result,
  contacts,
}: {
  result: ServiceRequestDetail;
  contacts: Contacts;
}) {
  // The lookup already answered whether the signed form arrived; a
  // successful upload in this same visit flips it without asking the server
  // to look everything up again.
  const [hasSignedForm, setHasSignedForm] = useState(result.hasSignedForm);
  const [signState, signAction, signing] = useActionState<
    AttachState,
    FormData
  >(attachSignedForm, { status: "idle" });
  const [docState, docAction, sendingDoc] = useActionState<
    AttachDocumentState,
    FormData
  >(attachExtraDocument, { status: "idle" });

  useEffect(() => {
    if (signState.status === "success") setHasSignedForm(true);
  }, [signState]);

  return (
    <div>
      <div className="rounded-2xl border border-brand-border bg-brand-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="text-[14.5px] font-bold tracking-wide text-brand-primary">
              {result.protocolNumber}
            </div>
            <div className="text-xs text-brand-muted">
              {result.actName} · {result.attributionName}
            </div>
          </div>
          <StatusBadge label={result.statusLabel} />
        </div>
      </div>

      <div className="mt-3.5 md:grid md:grid-cols-[1.1fr_0.9fr] md:items-start md:gap-4">
        <div className="flex flex-col gap-3.5">
          <RequirementsCard result={result} />
          {hasSignedForm ? (
            <div className="flex items-start gap-2.5 rounded-2xl border border-brand-border bg-brand-card p-4">
              <Icon
                name="check"
                className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary-soft"
                strokeWidth={2.4}
              />
              <p className="text-[12.5px] leading-relaxed text-brand-text-soft">
                <strong className="text-brand-primary">
                  Requerimento assinado recebido.
                </strong>{" "}
                A serventia já pode dar andamento ao pedido.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border-[1.5px] border-brand-accent-line bg-brand-accent-soft p-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-accent">
                  <Icon
                    name="pencil"
                    className="h-3.5 w-3.5 text-white"
                    strokeWidth={2}
                  />
                </span>
                <div>
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-brand-accent">
                    É a sua vez
                  </div>
                  <div className="font-serif text-[16.5px] font-semibold text-brand-primary">
                    Falta só o requerimento assinado
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-2">
                <form
                  action="/solicitar/requerimento"
                  method="post"
                  className="flex items-center gap-2.5 rounded-xl border border-brand-accent-line bg-brand-card px-3.5 py-3"
                >
                  <StepBadge>1</StepBadge>
                  <span className="flex-1 text-[12.5px] font-semibold text-brand-primary">
                    Baixe o requerimento preenchido
                  </span>
                  <input
                    type="hidden"
                    name="protocolNumber"
                    value={result.protocolNumber}
                  />
                  <input
                    type="hidden"
                    name="accessKey"
                    value={result.accessKey}
                  />
                  <button
                    type="submit"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-primary px-3 py-2 text-[11.5px] font-semibold text-white hover:bg-brand-primary-soft"
                  >
                    <Icon name="download" className="h-3 w-3" strokeWidth={2} />
                    PDF
                  </button>
                </form>

                <div className="flex items-start gap-2.5 rounded-xl border border-brand-accent-line bg-brand-card px-3.5 py-3">
                  <StepBadge>2</StepBadge>
                  <div className="flex-1 text-[12.5px] leading-relaxed text-brand-text-soft">
                    <strong className="text-brand-primary">Assine</strong> pelo
                    Gov.br em assinador.iti.br, ou imprima e assine de próprio
                    punho.
                  </div>
                </div>

                <div className="rounded-xl border border-brand-accent-line bg-brand-card px-3.5 py-3">
                  <div className="flex items-start gap-2.5">
                    <StepBadge>3</StepBadge>
                    <div className="flex-1">
                      <div className="text-[12.5px] font-semibold text-brand-primary">
                        Envie o arquivo assinado
                      </div>
                      <form action={signAction} className="mt-2">
                        <input
                          type="hidden"
                          name="protocolNumber"
                          value={result.protocolNumber}
                        />
                        <input
                          type="hidden"
                          name="accessKey"
                          value={result.accessKey}
                        />
                        <label
                          className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border-[1.5px] border-dashed border-brand-accent-line px-3 py-2.5 text-[12px] font-semibold text-brand-primary hover:border-brand-accent ${signing ? "opacity-60" : ""}`}
                        >
                          <Icon
                            name="plus"
                            className="h-3.5 w-3.5 text-brand-accent"
                          />
                          {signing
                            ? "Enviando..."
                            : "Anexar requerimento assinado"}
                          <input
                            type="file"
                            name="requerimento"
                            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                            className="sr-only"
                            disabled={signing}
                            onChange={(event) => {
                              if (event.target.files?.length) {
                                event.target.form?.requestSubmit();
                              }
                            }}
                          />
                        </label>
                      </form>
                      {signState.status !== "idle" && (
                        <output
                          className={`mt-1.5 block text-[11.5px] font-semibold ${
                            signState.status === "error"
                              ? "text-brand-alert"
                              : "text-brand-primary-soft"
                          }`}
                        >
                          {signState.message}
                        </output>
                      )}
                      <div className="mt-1.5 text-[11px] text-brand-faint">
                        Ou entregue em papel no balcão: o pedido não trava.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-brand-border bg-brand-card p-4">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-accent">
              Andamento
            </span>
            <ol className="mt-2.5 flex flex-col">
              <TimelineStep
                done
                label="Pedido recebido"
                detail={formatDateTime(result.createdAt)}
                lineBelow
              />
              {hasSignedForm ? (
                <TimelineStep
                  done
                  label="Requerimento assinado recebido"
                  detail={
                    result.signedFormReceivedAt
                      ? formatDateTime(result.signedFormReceivedAt)
                      : undefined
                  }
                />
              ) : (
                <TimelineStep
                  label="Aguardando requerimento assinado"
                  detail="o passo acima resolve isto"
                />
              )}
            </ol>
          </div>
        </div>

        <div className="mt-3.5 flex flex-col gap-3.5 md:mt-0">
          <div className="rounded-2xl border border-brand-border bg-brand-card p-4">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-accent">
              Seus arquivos
            </span>
            <form
              action="/solicitar/requerimento"
              method="post"
              className="mt-2.5 flex items-center gap-2.5 border-b border-brand-border pb-3"
            >
              <Icon
                name="file"
                className="h-4.5 w-4.5 shrink-0 text-brand-accent"
              />
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-brand-primary">
                  Requerimento em PDF
                </div>
                <div className="text-[11px] text-brand-faint">
                  gerado com os dados do pedido
                </div>
              </div>
              <input
                type="hidden"
                name="protocolNumber"
                value={result.protocolNumber}
              />
              <input type="hidden" name="accessKey" value={result.accessKey} />
              <button
                type="submit"
                className="shrink-0 text-[12px] font-bold text-brand-primary-soft"
              >
                Baixar
              </button>
            </form>
            <form action={docAction} className="mt-3">
              <input
                type="hidden"
                name="protocolNumber"
                value={result.protocolNumber}
              />
              <input type="hidden" name="accessKey" value={result.accessKey} />
              <label
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-brand-border px-3 py-3 text-[12.5px] font-semibold text-brand-primary hover:border-brand-accent ${sendingDoc ? "opacity-60" : ""}`}
              >
                <Icon name="plus" className="h-3.5 w-3.5 text-brand-accent" />
                {sendingDoc ? "Enviando..." : "Anexar outro documento"}
                <input
                  type="file"
                  name="documento"
                  accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                  className="sr-only"
                  disabled={sendingDoc}
                  onChange={(event) => {
                    if (event.target.files?.length) {
                      event.target.form?.requestSubmit();
                    }
                  }}
                />
              </label>
              {docState.status !== "idle" && (
                <output
                  className={`mt-1.5 block text-[11.5px] font-semibold ${
                    docState.status === "error"
                      ? "text-brand-alert"
                      : "text-brand-primary-soft"
                  }`}
                >
                  {docState.message}
                </output>
              )}
            </form>
            <p className="mt-2 text-[11px] text-brand-faint">
              Se a serventia pedir algo a mais, envie por aqui: chega direto no
              seu pedido.
            </p>
          </div>

          <div className="rounded-2xl border border-brand-border bg-brand-card p-4">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-accent">
              Documentos da serventia
            </span>
            <div className="mt-2.5 flex items-start gap-2.5">
              <Icon
                name="clock"
                className="mt-0.5 h-4 w-4 shrink-0 text-brand-faint"
              />
              <p className="text-[12px] leading-relaxed text-brand-muted">
                Nada por enquanto. Quando a serventia concluir, o arquivo
                aparece aqui e avisamos pelo seu contato. Fica disponível por{" "}
                <strong>30 dias</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-2xl border border-brand-border bg-brand-card p-4">
            <span className="flex-1 text-[12.5px] text-brand-text-soft">
              Dúvida sobre este pedido?
            </span>
            <a
              href={`https://wa.me/55${digits(contacts.whatsapp)}`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-tint px-3 py-2 text-[12px] font-bold text-brand-primary-soft"
            >
              <Icon name="chat" className="h-3.5 w-3.5" strokeWidth={1.8} />
              WhatsApp
            </a>
            <a
              href={`tel:+55${digits(contacts.phone)}`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-tint px-3 py-2 text-[12px] font-bold text-brand-primary-soft"
            >
              <Icon name="phone" className="h-3.5 w-3.5" strokeWidth={1.8} />
              Ligar
            </a>
          </div>
        </div>
      </div>

      <Link
        href="/protocolo"
        className="mt-4 inline-block text-xs font-semibold text-brand-primary-soft underline"
      >
        Nova consulta
      </Link>
    </div>
  );
}

function StepBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-brand-primary text-[11px] font-bold text-white">
      {children}
    </span>
  );
}

function DetailHeader({
  protocolNumber,
  subtitle,
  statusLabel,
}: {
  protocolNumber: string;
  subtitle: string;
  statusLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="text-[14.5px] font-bold tracking-wide text-brand-primary">
            {protocolNumber}
          </div>
          <div className="text-xs text-brand-muted">{subtitle}</div>
        </div>
        <StatusBadge label={statusLabel} />
      </div>
    </div>
  );
}

function Timeline({
  children,
  title = "Andamento",
}: {
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-card p-4">
      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-accent">
        {title}
      </span>
      <ol className="mt-2.5 flex flex-col">{children}</ol>
    </div>
  );
}

function band(hour: number): string {
  return `${hour}h às ${hour + 1}h`;
}

/**
 * The appointment. When the office proposed another band, the citizen's turn
 * is the loudest thing on the screen: nothing moves until they answer.
 */
function AppointmentCard({
  result,
  contacts,
}: {
  result: AppointmentDetail;
  contacts: Contacts;
}) {
  const [acceptState, acceptAction, accepting] = useActionState<
    AcceptProposalState,
    FormData
  >(acceptProposedSlot, { status: "idle" });

  const accepted = acceptState.status === "success" ? acceptState : undefined;
  const isAccepted = Boolean(result.acceptedAt) || Boolean(accepted);
  const hasProposal =
    Boolean(result.proposedDate) && result.proposedSlotHour !== undefined;

  const currentDate =
    isAccepted && hasProposal ? (result.proposedDate as string) : result.date;
  const currentHour =
    isAccepted && hasProposal
      ? (result.proposedSlotHour as number)
      : result.slotHour;

  return (
    <div>
      <DetailHeader
        protocolNumber={result.protocolNumber}
        subtitle="Agendamento de atendimento"
        statusLabel={isAccepted ? "Confirmado" : result.statusLabel}
      />

      <div className="mt-3.5 md:grid md:grid-cols-[1.1fr_0.9fr] md:items-start md:gap-4">
        <div className="flex flex-col gap-3.5">
          {hasProposal && !isAccepted ? (
            <div className="rounded-2xl border-[1.5px] border-brand-accent-line bg-brand-accent-soft p-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-accent">
                  <Icon
                    name="calendar"
                    className="h-3.5 w-3.5 text-white"
                    strokeWidth={2}
                  />
                </span>
                <div>
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-brand-accent">
                    É a sua vez
                  </div>
                  <div className="font-serif text-[16.5px] font-semibold text-brand-primary">
                    Confirme o novo horário
                  </div>
                </div>
              </div>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-brand-text-soft">
                A faixa que você pediu fechou. A serventia propôs outra:
              </p>
              <div className="mt-2.5 flex gap-2">
                <div className="flex-1 rounded-xl border border-brand-accent-line bg-brand-card px-3.5 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-brand-faint">
                    você pediu
                  </div>
                  <div className="mt-0.5 text-[13px] font-bold text-brand-faint line-through">
                    {formatShortDate(result.date)} · {band(result.slotHour)}
                  </div>
                </div>
                <div className="flex-1 rounded-xl border-[1.5px] border-brand-primary bg-brand-card px-3.5 py-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">
                    proposta
                  </div>
                  <div className="mt-0.5 text-[13px] font-bold text-brand-primary">
                    {formatShortDate(result.proposedDate as string)} ·{" "}
                    {band(result.proposedSlotHour as number)}
                  </div>
                </div>
              </div>
              <form action={acceptAction} className="mt-3 flex gap-2">
                <input
                  type="hidden"
                  name="protocolNumber"
                  value={result.protocolNumber}
                />
                <input
                  type="hidden"
                  name="accessKey"
                  value={result.accessKey}
                />
                <button
                  type="submit"
                  disabled={accepting}
                  className="flex-1 rounded-xl bg-brand-primary px-3 py-3 text-[13px] font-semibold text-white hover:bg-brand-primary-soft disabled:opacity-60"
                >
                  {accepting
                    ? "Confirmando..."
                    : `Aceitar ${formatShortDate(result.proposedDate as string)}`}
                </button>
                <a
                  href={`https://wa.me/55${digits(contacts.whatsapp)}`}
                  className="shrink-0 rounded-xl border border-brand-border bg-brand-card px-4 py-3 text-[13px] font-semibold text-brand-primary"
                >
                  Pedir outro
                </a>
              </form>
              {acceptState.status === "error" && (
                <p
                  role="alert"
                  className="mt-2 text-[12px] font-semibold text-brand-alert"
                >
                  {acceptState.message}
                </p>
              )}
              <p className="mt-2 text-[11px] text-brand-faint">
                Sem resposta em 2 dias úteis, a proposta expira e o pedido volta
                para você escolher.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-2xl border border-brand-border bg-brand-card p-4">
              <Icon
                name="calendar"
                className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent"
                strokeWidth={1.9}
              />
              <p className="text-[12.5px] leading-relaxed text-brand-text-soft">
                <strong className="text-brand-primary">
                  {formatShortDate(currentDate)} · {band(currentHour)}
                </strong>
                {isAccepted
                  ? ". Horário confirmado: compareça com documento com foto."
                  : ". A serventia confirma pelo contato informado, ou propõe outro horário aqui."}
              </p>
            </div>
          )}

          <Timeline>
            <TimelineStep
              done
              label="Pedido de horário recebido"
              detail={`${formatDateTime(result.createdAt)} · ${formatShortDate(result.date)}, ${band(result.slotHour)}`}
              lineBelow={hasProposal || isAccepted}
            />
            {hasProposal && (
              <TimelineStep
                done
                label={`Serventia propôs ${formatShortDate(result.proposedDate as string)}, ${band(result.proposedSlotHour as number)}`}
                detail={
                  result.proposedAt
                    ? formatDateTime(result.proposedAt)
                    : undefined
                }
                lineBelow
              />
            )}
            {isAccepted ? (
              <TimelineStep
                done
                label="Horário confirmado por você"
                detail={
                  result.acceptedAt
                    ? formatDateTime(result.acceptedAt)
                    : "agora"
                }
              />
            ) : (
              <TimelineStep
                label={
                  hasProposal
                    ? "Aguardando sua confirmação"
                    : "Aguardando confirmação da serventia"
                }
                detail={
                  hasProposal ? "os botões acima resolvem isto" : undefined
                }
              />
            )}
          </Timeline>
        </div>

        <div className="mt-3.5 flex flex-col gap-3.5 md:mt-0">
          {result.subject && (
            <div className="rounded-2xl border border-brand-border bg-brand-card p-4">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-accent">
                Sobre o atendimento
              </span>
              <p className="mt-2 text-[12.5px] leading-relaxed text-brand-text-soft">
                {result.subject}
              </p>
            </div>
          )}

          {/* POST, not a link: the key would otherwise sit in the address bar
              and in every access log on the way. */}
          <form
            action="/agendar/agenda"
            method="post"
            className="flex items-center gap-2.5 rounded-2xl border border-brand-border bg-brand-card p-4"
          >
            <Icon
              name="calendar"
              className="h-4.5 w-4.5 shrink-0 text-brand-accent"
            />
            <span className="flex-1 text-[13px] font-semibold text-brand-primary">
              Adicionar à agenda
            </span>
            <input
              type="hidden"
              name="protocolNumber"
              value={result.protocolNumber}
            />
            <input type="hidden" name="accessKey" value={result.accessKey} />
            <button
              type="submit"
              className="shrink-0 text-[12px] font-bold text-brand-primary-soft"
            >
              Baixar
            </button>
          </form>

          <div className="flex items-center gap-2.5 rounded-2xl border border-brand-border bg-brand-card p-4">
            <span className="flex-1 text-[12.5px] text-brand-text-soft">
              Nenhum desses dias serve?
            </span>
            <a
              href={`https://wa.me/55${digits(contacts.whatsapp)}`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-tint px-3 py-2 text-[12px] font-bold text-brand-primary-soft"
            >
              <Icon name="chat" className="h-3.5 w-3.5" strokeWidth={1.8} />
              WhatsApp
            </a>
          </div>
        </div>
      </div>

      <Link
        href="/protocolo"
        className="mt-4 inline-block text-xs font-semibold text-brand-primary-soft underline"
      >
        Nova consulta
      </Link>
    </div>
  );
}

/** The data rights requirement, and the officer's answer when it exists. */
function DataRightsCard({ result }: { result: DataRightsDetail }) {
  const option = DATA_RIGHT_OPTIONS.find((o) => o.id === result.right);
  const initials = result.dpoName
    .split(" ")
    .filter((part) => part.length > 2)
    .map((part) => part[0])
    .slice(0, 2)
    .join("");

  return (
    <div>
      <DetailHeader
        protocolNumber={result.protocolNumber}
        subtitle={`${option?.summary ?? "Direito do titular"} · canal LGPD`}
        statusLabel={result.statusLabel}
      />

      <div className="mt-3.5 md:grid md:grid-cols-[1.1fr_0.9fr] md:items-start md:gap-4">
        <div className="flex flex-col gap-3.5">
          {result.reply ? (
            <>
              <div className="rounded-2xl border border-brand-border bg-brand-card p-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-white">
                    {initials}
                  </span>
                  <div>
                    <div className="text-[12.5px] font-bold text-brand-primary">
                      {result.dpoName}
                    </div>
                    <div className="text-[11px] text-brand-muted">
                      Encarregado de Dados
                      {result.repliedAt
                        ? ` · respondeu em ${formatDate(result.repliedAt)}`
                        : ""}
                    </div>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-line text-[12.5px] leading-relaxed text-brand-text-soft">
                  {result.reply}
                </p>
              </div>
              <div className="flex items-start gap-2.5 rounded-2xl bg-brand-tint px-3.5 py-3">
                <Icon
                  name="lock"
                  className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary-soft"
                  strokeWidth={1.9}
                />
                <p className="text-[12px] leading-relaxed text-brand-primary">
                  Esta resposta só aparece para quem tem o protocolo e a chave.
                  A serventia nunca a envia por WhatsApp.
                </p>
              </div>
            </>
          ) : (
            <div className="flex items-start gap-2.5 rounded-2xl border border-brand-border bg-brand-card p-4">
              <Icon
                name="clock"
                className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent"
                strokeWidth={1.9}
              />
              <p className="text-[12.5px] leading-relaxed text-brand-text-soft">
                O Encarregado tem até{" "}
                <strong className="text-brand-primary">
                  {formatDate(`${result.deadline}T00:00:00`)}
                </strong>{" "}
                para responder. Quando responder, o texto aparece aqui, e nunca
                por outro canal.
              </p>
            </div>
          )}

          <Timeline>
            <TimelineStep
              done
              label="Pedido recebido"
              detail={formatDateTime(result.createdAt)}
              lineBelow
            />
            {result.reply ? (
              <TimelineStep
                done
                label="Respondido pelo Encarregado"
                detail={
                  result.repliedAt
                    ? `${formatDate(result.repliedAt)} · dentro do prazo legal`
                    : undefined
                }
              />
            ) : (
              <TimelineStep
                label="Aguardando resposta do Encarregado"
                detail={`dia ${result.dayOfDeadline} de ${DATA_RIGHTS_DEADLINE_DAYS} do prazo legal`}
              />
            )}
          </Timeline>
        </div>

        <div className="mt-3.5 flex flex-col gap-3.5 md:mt-0">
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
                  Resposta até {formatDate(`${result.deadline}T00:00:00`)}
                </div>
                <div className="text-[11.5px] text-brand-muted">
                  Prazo legal de {DATA_RIGHTS_DEADLINE_DAYS} dias
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-0.5">
              <span
                className="h-1.5 rounded-full bg-brand-accent"
                style={{
                  flex: Math.min(
                    result.dayOfDeadline,
                    DATA_RIGHTS_DEADLINE_DAYS,
                  ),
                }}
              />
              <span
                className="h-1.5 rounded-full bg-brand-tint"
                style={{
                  flex: Math.max(
                    DATA_RIGHTS_DEADLINE_DAYS - result.dayOfDeadline,
                    0,
                  ),
                }}
              />
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-brand-faint">
              Dia {result.dayOfDeadline} de {DATA_RIGHTS_DEADLINE_DAYS}.
            </p>
          </div>

          {/* POST, not a link: the receipt carries the holder's own data. */}
          <form
            action="/lgpd/recibo"
            method="post"
            className="flex items-center gap-2.5 rounded-2xl border border-brand-border bg-brand-card p-4"
          >
            <Icon
              name="file"
              className="h-4.5 w-4.5 shrink-0 text-brand-accent"
            />
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-brand-primary">
                Recibo do requerimento
              </div>
              <div className="text-[11px] text-brand-faint">
                PDF com o direito pedido e o prazo
              </div>
            </div>
            <input
              type="hidden"
              name="protocolNumber"
              value={result.protocolNumber}
            />
            <input type="hidden" name="accessKey" value={result.accessKey} />
            <button
              type="submit"
              className="shrink-0 text-[12px] font-bold text-brand-primary-soft"
            >
              Baixar
            </button>
          </form>

          <div className="flex items-start gap-2.5 rounded-2xl bg-brand-accent-soft px-3.5 py-3">
            <Icon
              name="shield"
              className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent"
              strokeWidth={1.9}
            />
            <p className="text-[12px] leading-relaxed text-brand-accent">
              Se houver dúvida sobre a titularidade, o Encarregado pede um
              documento pela própria consulta.
            </p>
          </div>
        </div>
      </div>

      <Link
        href="/protocolo"
        className="mt-4 inline-block text-xs font-semibold text-brand-primary-soft underline"
      >
        Nova consulta
      </Link>
    </div>
  );
}

/** The manifestation, its treatment and the ombudsman's answer. */
function OmbudsmanCard({ result }: { result: OmbudsmanDetail }) {
  return (
    <div>
      <DetailHeader
        protocolNumber={result.protocolNumber}
        subtitle={`${manifestationLabel(result.manifestationType)}${
          result.confidential ? " · identidade em sigilo" : ""
        }`}
        statusLabel={result.statusLabel}
      />

      <div className="mt-3.5 md:grid md:grid-cols-[1.1fr_0.9fr] md:items-start md:gap-4">
        <div className="flex flex-col gap-3.5">
          {result.reply ? (
            <div className="rounded-2xl border border-brand-border bg-brand-card p-4">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-brand-accent">
                Resposta da ouvidoria
              </span>
              <p className="mt-2 whitespace-pre-line text-[12.5px] leading-relaxed text-brand-text-soft">
                {result.reply}
              </p>
              {result.repliedAt && (
                <div className="mt-2.5 border-t border-brand-border pt-2.5 text-[11.5px] text-brand-faint">
                  Responsável pela ouvidoria · {formatDate(result.repliedAt)}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-2xl border border-brand-border bg-brand-card p-4">
              <Icon
                name="clock"
                className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent"
                strokeWidth={1.9}
              />
              <p className="text-[12.5px] leading-relaxed text-brand-text-soft">
                A manifestação está com o responsável da ouvidoria. A resposta
                aparece aqui, com o histórico do tratamento.
              </p>
            </div>
          )}

          <Timeline title="Histórico do tratamento">
            <TimelineStep
              done
              label="Manifestação registrada"
              detail={`${formatDateTime(result.createdAt)}${
                result.confidential ? " · com pedido de sigilo" : ""
              }`}
              lineBelow
            />
            {result.reply ? (
              <TimelineStep
                done
                label="Respondida e concluída"
                detail={
                  result.repliedAt ? formatDate(result.repliedAt) : undefined
                }
              />
            ) : (
              <TimelineStep label="Em apuração pelo responsável" />
            )}
          </Timeline>
        </div>

        <div className="mt-3.5 flex flex-col gap-3.5 md:mt-0">
          {result.confidential && (
            <div className="flex items-start gap-2.5 rounded-2xl bg-brand-tint px-3.5 py-3">
              <Icon
                name="shield"
                className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary-soft"
                strokeWidth={1.9}
              />
              <p className="text-[12px] leading-relaxed text-brand-primary">
                Seu nome não apareceu em nenhuma etapa acima: só o responsável
                da ouvidoria teve acesso.
              </p>
            </div>
          )}
          <Link
            href="/ouvidoria"
            className="rounded-2xl border border-brand-border bg-brand-card px-4 py-3.5 text-center text-[13px] font-semibold text-brand-primary hover:border-brand-accent"
          >
            Nova manifestação
          </Link>
        </div>
      </div>

      <Link
        href="/protocolo"
        className="mt-4 inline-block text-xs font-semibold text-brand-primary-soft underline"
      >
        Nova consulta
      </Link>
    </div>
  );
}
