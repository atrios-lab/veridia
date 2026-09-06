"use client";

import { Fragment, useActionState, useEffect, useRef, useState } from "react";
import type { PauseReason } from "@/core/request/deadline.ts";
import { useLiveVersion } from "../../_components/use-live-version.ts";
import { Icon } from "../_components/icon.tsx";
import {
  ATTACHMENT_ACCEPT,
  useAttachmentUpload,
} from "../_lib/attachments.tsx";
import {
  type AttachDocumentState,
  attachExtraDocument,
  type CitizenDocumentView,
  type FulfillRequirementState,
  type LookupState,
  lookupProtocolDetail,
  type ProtocolDetail,
  protocolVersion,
  type RequirementMessageView,
  type RequirementView,
  type ServiceRequestDetail,
  writeRequirementMessageAction,
} from "../protocolo/actions.ts";
import {
  DataRightsCard,
  OmbudsmanCard,
} from "../protocolo/protocol-lookup.tsx";
import { type AttachState, attachSignedForm } from "../solicitar/actions.ts";

const inputClass =
  "w-full rounded-xl border border-brand-border bg-brand-surface px-3.5 py-3 text-sm text-brand-text outline-none placeholder:text-brand-faint focus:border-brand-accent";

/* ---------------------------------------------------------------- dates */

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

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(
    d,
  );
  const month = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(d);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${d.getDate()} de ${month}`;
}

/** Local, calendar-day math for "available until": the office's PDF stays
 * downloadable for 30 straight days, not 30 business days. */
function addCalendarDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** Same wording the rest of the site uses for a paused term (see
 * DeadlineNote in protocolo/protocol-lookup.tsx): kept in sync there rather
 * than imported, since it is two lines of vocabulary, not logic. */
const PAUSE_LABELS: Record<PauseReason, string> = {
  requirement: "o cumprimento da exigência",
  payment: "o pagamento",
};

/* ---------------------------------------------------------------- tone */

type Tone = "ink" | "gold" | "green" | "red";

function toneText(tone: Tone): string {
  switch (tone) {
    case "red":
      return "text-brand-alert";
    case "gold":
      return "text-brand-accent";
    case "green":
      return "text-brand-primary-soft";
    default:
      return "text-brand-text";
  }
}

function toneBg(tone: Tone): string {
  switch (tone) {
    case "red":
      return "bg-brand-alert";
    case "gold":
      return "bg-brand-accent";
    case "green":
      return "bg-brand-primary-soft";
    default:
      return "bg-brand-text";
  }
}

function toneBorder(tone: Tone): string {
  switch (tone) {
    case "red":
      return "border-brand-alert";
    case "gold":
      return "border-brand-accent";
    case "green":
      return "border-brand-primary-soft";
    default:
      return "border-brand-text";
  }
}

// Two shades check:tokens has no name for (a pastel alert wash and a soft
// primary-soft border): mixed from the tokens, so no literal hex joins them.
const REJECTED_BG =
  "bg-[color-mix(in_srgb,var(--color-brand-alert)_14%,white)]";
const REJECTED_BORDER =
  "border-[color-mix(in_srgb,var(--color-brand-alert)_35%,white)]";
const DONE_BORDER =
  "border-[color-mix(in_srgb,var(--color-brand-primary-soft)_45%,white)]";

/* ---------------------------------------------------------------- steps */

interface Step {
  label: string;
  done?: boolean;
  alert?: boolean;
  /** Whoever moves this step forward is the citizen, not the office. */
  citizen?: boolean;
}

function waitingOnCitizen(requirement: RequirementView): boolean {
  if (requirement.status !== "pending") return false;
  const last = requirement.messages[requirement.messages.length - 1];
  return !last || last.author === "staff";
}

function computeSteps(
  result: ServiceRequestDetail,
  hasSignedForm: boolean,
  rejected: boolean,
  finished: boolean,
): Step[] {
  const steps: Step[] = [{ label: "Pedido recebido", done: true }];
  steps.push(
    hasSignedForm
      ? { label: "Formulário assinado", done: true }
      : { label: "Formulário assinado", citizen: true },
  );
  if (result.requirements.length > 0) {
    const anyPending = result.requirements.some((r) => r.status === "pending");
    steps.push(
      anyPending
        ? {
            label: "Pedido do cartório",
            citizen: result.requirements.some(waitingOnCitizen),
          }
        : { label: "Pedido do cartório", done: true },
    );
  }
  if (result.amountLabel) {
    steps.push(
      result.paymentSettled
        ? { label: "Pagamento", done: true }
        : { label: "Pagamento", citizen: true },
    );
  }
  if (rejected) {
    return steps
      .filter((s) => s.done)
      .concat([
        {
          label:
            result.requestStatus === "rejected"
              ? "Pedido não aceito"
              : "Pedido cancelado",
          alert: true,
        },
      ]);
  }
  steps.push({ label: "Preparando o documento", done: finished });
  steps.push({
    label: finished ? "Documento entregue" : "Conclusão e entrega",
    done: finished,
  });
  return steps;
}

function stepTone(steps: Step[], index: number): Tone {
  const step = steps[index];
  if (step.alert) return "red";
  const curIdx = steps.findIndex((s) => !s.done && !s.alert);
  return index === curIdx && step.citizen ? "gold" : "green";
}

/* ---------------------------------------------------------------- pill */

function computePill(
  result: ServiceRequestDetail,
  hasSignedForm: boolean,
  rejected: boolean,
  finished: boolean,
  anyPendingRequirement: boolean,
  awaitingPay: boolean,
): { label: string; tone: Tone } {
  if (rejected) {
    return {
      label:
        result.requestStatus === "rejected" ? "Não aceito" : result.statusLabel,
      tone: "red",
    };
  }
  if (finished) return { label: "Concluído", tone: "green" };
  if (awaitingPay && !anyPendingRequirement) {
    return { label: "Falta pagar", tone: "gold" };
  }
  if (!hasSignedForm || anyPendingRequirement || awaitingPay) {
    return { label: "Sua vez", tone: "gold" };
  }
  return { label: "Em andamento", tone: "green" };
}

/* ---------------------------------------------------------------- copy */

function computeHeadline(
  result: ServiceRequestDetail,
  hasSignedForm: boolean,
  rejected: boolean,
  finished: boolean,
  pendingRequirement: RequirementView | undefined,
  awaitingPay: boolean,
): { headline: string; leadDate: string; leadText: string } {
  if (rejected) {
    return {
      headline: "Não conseguimos atender este pedido.",
      leadDate: `${formatDate(result.updatedAt)}:`,
      leadText:
        "explicamos o motivo na mensagem que enviamos para você. Se ficou alguma dúvida, fale com a gente. Você pode fazer um novo pedido quando quiser.",
    };
  }
  if (finished) {
    const at = result.deliveredDocuments[0]?.createdAt ?? result.updatedAt;
    return {
      headline: "Pronto! Seu documento está aqui.",
      leadDate: `${formatDateTime(at)}:`,
      leadText:
        "terminamos o seu pedido. É só baixar ao lado. O arquivo fica disponível por 30 dias.",
    };
  }
  if (!hasSignedForm) {
    return {
      headline: "Falta só a sua assinatura.",
      leadDate: `${formatDateTime(result.createdAt)}:`,
      leadText:
        "recebemos o seu pedido. Agora precisamos do formulário assinado por você. Depois disso, o cartório começa a trabalhar no seu pedido. Se precisarmos de algo, avisamos por aqui.",
    };
  }
  if (pendingRequirement) {
    const last =
      pendingRequirement.messages[pendingRequirement.messages.length - 1];
    if (!last || last.author === "staff") {
      return {
        headline: "Precisamos de uma informação a mais.",
        leadDate: `${formatDate(last ? last.createdAt : pendingRequirement.createdAt)}:`,
        leadText:
          (last
            ? "o cartório respondeu e está esperando você."
            : "o cartório pediu uma informação e está esperando você.") +
          " Responda ao lado, escrevendo ou enviando um arquivo. Assim que conferirmos, o pedido continua.",
      };
    }
    return {
      headline: "Recebemos a sua resposta.",
      leadDate: `${formatDateTime(last.createdAt)}:`,
      leadText:
        "você não precisa fazer nada agora. Vamos conferir o que você enviou e o pedido segue. Se faltar algo, escrevemos aqui.",
    };
  }
  if (awaitingPay) {
    return {
      headline: "Falta só o pagamento.",
      leadDate: `${formatDate(result.updatedAt)}:`,
      leadText: `o valor do seu documento é ${result.amountLabel}. Pague pelo Pix ao lado. Assim que o pagamento cair, começamos a preparar.`,
    };
  }
  return {
    headline: "Agora é com a gente.",
    leadDate: `${formatDateTime(result.signedFormReceivedAt ?? result.createdAt)}:`,
    leadText:
      "sua parte está feita por enquanto. Estamos cuidando do seu pedido e avisamos você quando ficar pronto ou se precisarmos de algo.",
  };
}

function computePrazo(
  result: ServiceRequestDetail,
  rejected: boolean,
  finished: boolean,
): { prazoStrong: string; prazoText: string } {
  if (rejected) {
    return {
      prazoStrong: "Pedido encerrado.",
      prazoText: " O prazo não conta mais.",
    };
  }
  if (finished) {
    return {
      prazoStrong: "Entregue no prazo.",
      prazoText: ` A previsão era ${formatDate(result.deadlineTerm.date)}.`,
    };
  }
  const d = result.deadline;
  if (d?.paused?.length) {
    const words = d.paused.map((r) => PAUSE_LABELS[r]).join(" e ");
    return {
      prazoStrong: "Prazo em pausa:",
      prazoText: ` estamos esperando ${words}. Quando isso for resolvido, a contagem continua.`,
    };
  }
  if ((d?.dayOfTerm ?? 0) === 0) {
    return {
      prazoStrong: "Previsão de entrega:",
      prazoText: ` até ${formatDate(result.deadlineTerm.date)}. A contagem começa no próximo dia útil e pode mudar, porque atendemos por ordem de chegada.`,
    };
  }
  return {
    prazoStrong: "Previsão de entrega:",
    prazoText: ` até ${formatDate(result.deadlineTerm.date)}. Estamos no dia ${d?.dayOfTerm ?? 0} de ${result.deadlineTerm.days} dias úteis. A data pode mudar, porque atendemos por ordem de chegada.`,
  };
}

/* ------------------------------------------------------------- history */

interface LogEvent {
  at: string;
  title: string;
  sub?: string;
  tone: Tone;
}

/**
 * Built only from timestamps this consult already carries. The office's
 * internal audit trail has entries with no citizen-safe wording and no
 * per-event date for a few transitions (valor definido, pago, indeferido),
 * so those show up in the cards above but not as their own dated line here.
 */
function buildHistory(
  result: ServiceRequestDetail,
  hasSignedForm: boolean,
  rejected: boolean,
): LogEvent[] {
  const log: LogEvent[] = [
    {
      at: result.createdAt,
      title: "Pedido recebido.",
      sub: "Criamos o formulário com os dados do seu pedido.",
      tone: "ink",
    },
  ];
  if (hasSignedForm && result.signedFormReceivedAt) {
    log.push({
      at: result.signedFormReceivedAt,
      title: "Formulário assinado recebido.",
      sub: "Enviado por você por aqui.",
      tone: "ink",
    });
  }
  for (const req of result.requirements) {
    log.push({
      at: req.createdAt,
      title: "O cartório pediu uma informação.",
      sub: "Prazo em pausa até você responder.",
      tone: "gold",
    });
    for (const m of req.messages) {
      const fileNote =
        m.attachments.length > 0
          ? `${m.attachments.length > 1 ? `${m.attachments.length} arquivos` : "1 arquivo"}${m.body ? ` · ${m.body}` : ""}`
          : m.body;
      log.push({
        at: m.createdAt,
        title:
          m.author === "staff" ? "O cartório respondeu." : "Você respondeu.",
        sub: fileNote,
        tone: m.author === "staff" ? "gold" : "ink",
      });
    }
    if (req.fulfilledAt) {
      log.push({
        at: req.fulfilledAt,
        title: "Informação conferida.",
        sub: "Deu tudo certo com o que você enviou. O prazo voltou a contar.",
        tone: "green",
      });
    }
  }
  for (const doc of result.citizenDocuments) {
    log.push({
      at: doc.createdAt,
      title: "Você enviou um arquivo.",
      sub: doc.displayName,
      tone: "ink",
    });
  }
  for (const doc of result.deliveredDocuments) {
    log.push({
      at: doc.createdAt,
      title: "Documento entregue.",
      sub: "Fica disponível por 30 dias nesta página.",
      tone: "green",
    });
  }
  if (rejected) {
    log.push({
      at: result.updatedAt,
      title:
        result.requestStatus === "rejected"
          ? "Pedido não aceito."
          : "Pedido cancelado.",
      sub: "Enviamos o motivo para você.",
      tone: "red",
    });
  }
  return log;
}

interface HistoryGroup {
  day: string;
  tone: Tone;
  events: LogEvent[];
}

function groupHistory(log: LogEvent[]): HistoryGroup[] {
  const byDay = new Map<string, LogEvent[]>();
  for (const event of log) {
    const key = formatDate(event.at);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(event);
    else byDay.set(key, [event]);
  }
  return [...byDay.values()]
    .map((events) => {
      const sorted = [...events].sort(
        (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
      );
      return {
        day: formatDay(sorted[0].at),
        at: sorted[0].at,
        tone: sorted[0].tone,
        events: sorted,
      };
    })
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .map(({ day, tone, events }, index) => ({
      day,
      tone: index === 0 ? tone : ("ink" as const),
      events,
    }));
}

/* ---------------------------------------------------------------- gate */

function Gate({
  initialNumber,
  action,
  pending,
  error,
}: {
  initialNumber?: string;
  action: (data: FormData) => void;
  pending: boolean;
  error?: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 py-16 text-center">
      <div className="flex flex-col items-center gap-2.5">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-brand-accent-ink">
          Acompanhar pedido
        </span>
        <h1 className="font-serif text-3xl font-semibold text-brand-primary">
          Veja o andamento
        </h1>
        <p className="text-sm leading-relaxed text-brand-muted">
          Digite o número do protocolo e a chave de acesso que você recebeu ao
          fazer o pedido.
        </p>
      </div>
      <form action={action} className="flex w-full flex-col gap-3 text-left">
        <div>
          <label
            htmlFor="protocolNumber"
            className="mb-1.5 block text-[13px] font-semibold text-brand-primary"
          >
            Número do protocolo
          </label>
          <input
            id="protocolNumber"
            name="protocolNumber"
            required
            defaultValue={initialNumber}
            placeholder="REQ.2026.000200"
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="accessKey"
            className="mb-1.5 block text-[13px] font-semibold text-brand-primary"
          >
            Chave de acesso
          </label>
          <input
            id="accessKey"
            name="accessKey"
            required
            placeholder="Ex.: BBM8-6XVB-8PUK"
            className={inputClass}
          />
        </div>
        {error && (
          <p
            role="alert"
            className="text-[13px] font-semibold text-brand-alert"
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary btn-lg mt-1"
        >
          {pending ? "Verificando..." : "Ver andamento"}
        </button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------ progress */

function ProgressRail({ steps }: { steps: Step[] }) {
  return (
    <div className="hidden gap-3.5 md:flex">
      {steps.map((step, i) => {
        const tone = stepTone(steps, i);
        const curIdx = steps.findIndex((s) => !s.done && !s.alert);
        const cur = i === curIdx;
        const filled = step.done || step.alert;
        const active = filled || cur;
        return (
          <div key={step.label} className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="h-[5px] overflow-hidden rounded-full bg-brand-border">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${toneBg(tone)}`}
                style={{ width: filled ? "100%" : cur ? "50%" : "0%" }}
              />
            </div>
            <div
              className={`text-center text-sm leading-tight ${
                active ? (cur ? "font-bold" : "font-semibold") : "font-normal"
              } ${step.alert ? "text-brand-alert" : cur ? toneText(tone) : step.done ? "text-brand-text" : "text-brand-faint"}`}
            >
              {step.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProgressDots({
  steps,
  rejected,
}: {
  steps: Step[];
  rejected: boolean;
}) {
  const curIdx = steps.findIndex((s) => !s.done && !s.alert);
  const stepName =
    curIdx >= 0
      ? steps[curIdx].label
      : rejected
        ? "Pedido não aceito"
        : "Documento entregue";
  const stepKicker =
    curIdx >= 0
      ? `Etapa ${curIdx + 1} de ${steps.length}`
      : rejected
        ? "Encerrado"
        : "Concluído";
  const waitingCitizen = curIdx >= 0 && Boolean(steps[curIdx].citizen);
  const kickerColor = rejected
    ? "text-brand-alert"
    : waitingCitizen
      ? "text-brand-accent"
      : "text-brand-primary-soft";

  return (
    <div className="flex flex-col items-center gap-3 md:hidden">
      <div className="flex w-full items-center px-1.5">
        {steps.map((step, i) => {
          const tone = stepTone(steps, i);
          const cur = i === curIdx;
          const filled = step.done || step.alert;
          const size = filled
            ? "h-5 w-5"
            : cur
              ? "h-[22px] w-[22px]"
              : "h-3.5 w-3.5";
          return (
            <Fragment key={step.label}>
              <span
                className={`flex shrink-0 items-center justify-center rounded-full transition-all ${size} ${
                  filled
                    ? toneBg(tone)
                    : cur
                      ? `border-[3px] bg-brand-card ${toneBorder(tone)}`
                      : "bg-brand-border"
                }`}
              >
                {step.done && (
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m5 12 5 5L20 7" />
                  </svg>
                )}
              </span>
              {i < steps.length - 1 && (
                <span
                  className={`h-1 flex-1 transition-colors ${filled ? toneBg(tone) : "bg-brand-border"}`}
                />
              )}
            </Fragment>
          );
        })}
      </div>
      <div className="text-center">
        <div
          className={`text-[11px] font-bold uppercase tracking-[0.14em] ${kickerColor}`}
        >
          {stepKicker}
        </div>
        <div className="mt-0.5 text-[15px] font-semibold text-brand-text">
          {stepName}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- sign card */

function SignCard({
  protocolNumber,
  accessKey,
  onSigned,
}: {
  protocolNumber: string;
  accessKey: string;
  onSigned: () => void;
}) {
  const [state, action, pending] = useActionState<AttachState, FormData>(
    attachSignedForm,
    { status: "idle" },
  );
  const { send, uploading, error } = useAttachmentUpload(action);
  const sending = pending || uploading;

  useEffect(() => {
    if (state.status === "success") onSigned();
  }, [state, onSigned]);

  return (
    <div className="flex animate-notice-rise flex-col gap-3 rounded-2xl border border-brand-border bg-brand-card p-5 shadow-[0_1px_2px_rgba(20,40,25,.05)]">
      <div className="flex items-center gap-3">
        <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-white">
          1
        </span>
        <span className="flex-1 text-[15px] font-semibold">
          Baixe o formulário já preenchido
        </span>
        <form action="/solicitar/requerimento" method="post">
          <input type="hidden" name="protocolNumber" value={protocolNumber} />
          <input type="hidden" name="accessKey" value={accessKey} />
          <button
            type="submit"
            className="btn btn-primary min-h-11 px-4 py-2.5 text-sm"
          >
            <Icon name="download" className="h-3.5 w-3.5" strokeWidth={2} />
            PDF
          </button>
        </form>
      </div>
      <div className="h-px bg-brand-border" />
      <div className="flex items-start gap-3">
        <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-white">
          2
        </span>
        <span className="text-[15px] leading-relaxed">
          <strong>Assine</strong> pelo Gov.br (em assinador.iti.br) ou imprima e
          assine à mão.
        </span>
      </div>
      <div className="h-px bg-brand-border" />
      <div className="flex items-start gap-3">
        <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-white">
          3
        </span>
        <div className="flex flex-1 flex-col gap-2.5">
          <span className="text-[15px] font-semibold">
            Envie o formulário assinado
          </span>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(event.currentTarget, "requerimento", 1);
            }}
          >
            <input type="hidden" name="protocolNumber" value={protocolNumber} />
            <input type="hidden" name="accessKey" value={accessKey} />
            <label
              className={`flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-[11px] border-[1.5px] border-dashed border-brand-accent-line px-3 py-3 text-center text-[14.5px] font-semibold text-brand-primary ${sending ? "opacity-60" : "hover:bg-brand-tint"}`}
            >
              <span className="text-brand-accent">
                <Icon name="plus" className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
              {sending ? "Enviando..." : "Enviar formulário assinado"}
              <input
                type="file"
                name="requerimento"
                accept={ATTACHMENT_ACCEPT}
                className="sr-only"
                disabled={sending}
                onChange={(event) => {
                  if (event.target.files?.length)
                    event.target.form?.requestSubmit();
                }}
              />
            </label>
          </form>
          {(error || state.status === "error") && (
            <output className="text-[12.5px] font-semibold text-brand-alert">
              {error ?? (state.status === "error" && state.message)}
            </output>
          )}
          <span className="text-[13px] text-brand-muted">
            Se preferir, entregue em papel no balcão. Seu pedido continua
            valendo.
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------ requirement card */

function RequirementCard({
  requirement,
  protocolNumber,
  accessKey,
  onSent,
}: {
  requirement: RequirementView;
  protocolNumber: string;
  accessKey: string;
  /** Appends the message locally: the action itself returns no payload, and
   * nothing here re-queries the record, so without this the reply the
   * citizen just sent would vanish from the thread until the next lookup. */
  onSent: (message: RequirementMessageView) => void;
}) {
  const [state, action, pending] = useActionState<
    FulfillRequirementState,
    FormData
  >(writeRequirementMessageAction, { status: "idle" });
  const { send, uploading, error } = useAttachmentUpload(action);
  const [draft, setDraft] = useState("");
  // Capped at 3, matching the server's limit for a reply (see collectAttachments
  // call in writeRequirementMessageAction): a reply is a chat message, not a
  // filing, so it carries fewer files than the request's own upload does.
  const MAX_REPLY_FILES = 3;
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sending = pending || uploading;
  const cantSend = sending || (!draft.trim() && files.length === 0);
  const pendingReply = waitingOnCitizen(requirement);

  // A native file input replaces its whole selection on every pick, so
  // picking twice would lose the first file. Staging the merged list in
  // state and writing it back via DataTransfer lets "Anexar" add one at a
  // time while still handing the real input's FormData entry to the action.
  function syncInputFiles(next: File[]) {
    setFiles(next);
    if (fileInputRef.current) {
      const transfer = new DataTransfer();
      for (const file of next) transfer.items.add(file);
      fileInputRef.current.files = transfer.files;
    }
  }

  function addFiles(picked: File[]) {
    syncInputFiles([...files, ...picked].slice(0, MAX_REPLY_FILES));
  }

  function removeFile(index: number) {
    syncInputFiles(files.filter((_, i) => i !== index));
  }

  // A conversation the design never had to picture: its own demo tops out at
  // four bubbles. A real one can run much longer, so the thread scrolls
  // inside a capped height instead of pushing "Anexar"/"Enviar" down the page.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-runs on a new message, the ref itself is never a reactive value.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [requirement.messages.length]);
  // What the effect below appends once the action confirms: captured at
  // submit time, since `state` carries no payload back and by the time it
  // flips to "success" the form fields have already been cleared.
  const submittedRef = useRef<{ body: string; fileNames: string[] }>(undefined);

  // biome-ignore lint/correctness/useExhaustiveDependencies: syncInputFiles is a plain function recreated every render, not a value this effect reacts to.
  useEffect(() => {
    if (state.status === "success" && submittedRef.current) {
      const { body, fileNames } = submittedRef.current;
      onSent({
        id: crypto.randomUUID(),
        author: "citizen",
        authorName: "Você",
        body,
        createdAt: new Date().toISOString(),
        attachments: fileNames.map((name) => ({
          id: crypto.randomUUID(),
          displayName: name,
        })),
      });
      submittedRef.current = undefined;
      setDraft("");
      syncInputFiles([]);
    }
  }, [state, onSent]);

  return (
    <div
      className={`flex animate-notice-rise flex-col gap-4 rounded-2xl border-[1.5px] p-5 ${
        pendingReply
          ? "border-brand-on-dark-accent bg-brand-accent-soft"
          : "border-brand-border bg-brand-card"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-[3px] text-[11px] font-bold ${
            pendingReply
              ? "bg-brand-accent text-white"
              : "bg-brand-tint text-brand-primary-soft"
          }`}
        >
          {pendingReply ? "Sua vez" : "Respondido · estamos conferindo"}
        </span>
        <span className="text-xs text-brand-muted">
          pedido feito em {formatDate(requirement.createdAt)}
        </span>
      </div>
      <p className="text-[15.5px] font-semibold leading-snug text-brand-primary">
        {requirement.text}
      </p>
      {requirement.forms.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-brand-muted">
            Se preferir, imprima e preencha à mão
          </span>
          {requirement.forms.map((form, index) => (
            <form
              key={form.id}
              action="/protocolo/documento"
              method="post"
              className="flex items-center gap-2.5 rounded-[10px] border border-brand-border bg-brand-card px-3.5 py-2.5"
            >
              <Icon
                name="file"
                className="h-4 w-4 shrink-0 text-brand-accent"
              />
              <span className="flex-1 truncate text-sm">
                {requirement.forms.length > 1
                  ? `Formulário ${index + 1}`
                  : "Formulário"}
              </span>
              <input
                type="hidden"
                name="protocolNumber"
                value={protocolNumber}
              />
              <input type="hidden" name="accessKey" value={accessKey} />
              <input type="hidden" name="attachmentId" value={form.id} />
              <button type="submit" className="btn btn-ghost btn-sm">
                Baixar
              </button>
            </form>
          ))}
        </div>
      )}
      {requirement.messages.length > 0 && (
        <>
          <div className="h-px bg-brand-on-dark-accent" />
          <div className="flex max-h-80 flex-col gap-3.5 overflow-y-auto pr-1">
            {requirement.messages.map((m) => {
              const citizen = m.author === "citizen";
              return (
                <div
                  key={m.id}
                  className={`flex min-w-0 animate-notice-rise items-start gap-2.5 ${citizen ? "flex-row-reverse" : ""}`}
                >
                  <span
                    className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[11.5px] font-bold ${
                      citizen
                        ? "bg-brand-tint text-brand-primary"
                        : "bg-brand-primary text-white"
                    }`}
                  >
                    {citizen ? "" : "AP"}
                    {citizen &&
                      m.authorName
                        .trim()
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((w) => w[0]?.toUpperCase())
                        .join("")}
                  </span>
                  <div
                    className={`flex max-w-[85%] min-w-0 flex-col gap-1 ${citizen ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`flex flex-wrap items-baseline gap-2 ${citizen ? "flex-row-reverse" : ""}`}
                    >
                      <span className="text-[13px] font-bold text-brand-primary">
                        {m.authorName}
                      </span>
                      <span className="text-[11.5px] text-brand-faint">
                        {formatDate(m.createdAt)}
                      </span>
                    </div>
                    {m.body && (
                      <p
                        className={`m-0 max-w-full min-w-0 [overflow-wrap:anywhere] whitespace-pre-line rounded-xl px-3 py-2 text-sm leading-relaxed ${
                          citizen
                            ? "bg-brand-primary text-white"
                            : "bg-brand-card text-brand-text"
                        }`}
                      >
                        {m.body}
                      </p>
                    )}
                    {m.attachments.map((file) => (
                      // The whole chip is the download, same as the panel's:
                      // a POST because the file sits behind the access key.
                      <form
                        key={file.id}
                        action="/protocolo/documento"
                        method="post"
                        className="min-w-0 max-w-full"
                      >
                        <input
                          type="hidden"
                          name="protocolNumber"
                          value={protocolNumber}
                        />
                        <input
                          type="hidden"
                          name="accessKey"
                          value={accessKey}
                        />
                        <input
                          type="hidden"
                          name="attachmentId"
                          value={file.id}
                        />
                        <button
                          type="submit"
                          aria-label={`Baixar ${file.displayName}`}
                          className="flex min-w-0 max-w-full cursor-pointer items-center gap-1.5 rounded-[10px] border border-brand-border bg-brand-card px-3 py-1.5 text-[12px] font-semibold text-brand-primary-soft hover:border-brand-accent"
                        >
                          <Icon name="file" className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{file.displayName}</span>
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </>
      )}
      <div className="flex flex-col gap-2.5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submittedRef.current = {
              body: draft.trim(),
              fileNames: files.map((f) => f.name),
            };
            void send(event.currentTarget, "resposta", MAX_REPLY_FILES);
          }}
          className="flex flex-col gap-2.5"
        >
          <input type="hidden" name="protocolNumber" value={protocolNumber} />
          <input type="hidden" name="accessKey" value={accessKey} />
          <input type="hidden" name="requirementId" value={requirement.id} />
          <textarea
            name="mensagem"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={2}
            disabled={sending}
            placeholder={
              pendingReply
                ? "Escreva sua resposta aqui..."
                : "Quer acrescentar algo? Escreva aqui..."
            }
            className="min-h-16 w-full resize-y rounded-xl border border-brand-border bg-brand-card px-3.5 py-3 text-sm leading-relaxed text-brand-text outline-none focus:border-brand-accent focus:shadow-[0_0_0_3px_rgba(143,114,56,.15)]"
          />
          {files.map((file, index) => (
            <div
              key={`${file.name}-${file.lastModified}`}
              className="flex min-w-0 items-center gap-2 rounded-[10px] border border-brand-border bg-brand-card px-3 py-2 text-[13px]"
            >
              <Icon
                name="file"
                className="h-3.5 w-3.5 shrink-0 text-brand-accent"
              />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="shrink-0 text-brand-muted hover:text-brand-alert"
              >
                Remover
              </button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              ref={fileInputRef}
              type="file"
              name="resposta"
              accept={ATTACHMENT_ACCEPT}
              multiple
              className="sr-only"
              disabled={sending || files.length >= MAX_REPLY_FILES}
              onChange={(event) =>
                addFiles(Array.from(event.target.files ?? []))
              }
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || files.length >= MAX_REPLY_FILES}
              className="btn btn-secondary min-h-11 px-3.5 py-2 text-sm"
            >
              <Icon name="paperclip" className="h-3.5 w-3.5" />
              {files.length > 0
                ? `Anexar (${files.length}/${MAX_REPLY_FILES})`
                : "Anexar"}
            </button>
            <button
              type="submit"
              disabled={cantSend}
              className="btn btn-primary ml-auto min-h-11 px-5 py-2.5 text-sm"
            >
              {sending ? "Enviando…" : "Enviar"}
            </button>
          </div>
        </form>
        {(error || state.status === "error") && (
          <output className="text-[12.5px] font-semibold text-brand-alert">
            {error ?? (state.status === "error" && state.message)}
          </output>
        )}
        <span className="text-[12.5px] text-brand-muted">
          Sua resposta chega direto para quem cuida do seu pedido. Se preferir,
          pode entregar em papel no balcão.
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- payment */

function PayCard({ result }: { result: ServiceRequestDetail }) {
  const [copied, setCopied] = useState(false);
  const pix = result.pix;
  return (
    <div className="flex animate-notice-rise flex-col gap-4 rounded-2xl border-[1.5px] border-brand-on-dark-accent bg-brand-accent-soft p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-brand-accent-ink">
          Pagamento via Pix
        </span>
        <span className="font-serif text-[28px] font-semibold text-brand-primary">
          {result.amountLabel}
        </span>
      </div>
      {pix ? (
        <div className="flex flex-wrap items-center gap-4">
          <div
            className="flex h-[132px] w-[132px] shrink-0 items-center justify-center rounded-xl border border-brand-border bg-brand-card p-2.5 [&>svg]:h-full [&>svg]:w-full"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: pix.qrSvg is deterministic SVG rendered server-side by `qrcode`, never citizen input.
            dangerouslySetInnerHTML={{ __html: pix.qrSvg }}
          />
          <div className="flex min-w-[180px] flex-1 flex-col gap-2">
            <span className="text-sm leading-relaxed">
              Abra o app do seu banco e aponte a câmera, ou copie o código:
            </span>
            <div className="flex items-center gap-2 rounded-[10px] border border-brand-border bg-brand-card px-3 py-2.5">
              <span className="flex-1 truncate text-xs text-brand-muted">
                {pix.copyPaste}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(pix.copyPaste).then(
                    () => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    },
                    () => setCopied(false),
                  );
                }}
                className="text-[13px] font-semibold text-brand-primary-soft hover:underline"
              >
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
            <span className="text-[12.5px] text-brand-muted">
              O pagamento é confirmado sozinho, em até 1 dia útil. Não precisa
              mandar comprovante.
            </span>
          </div>
        </div>
      ) : (
        <p className="text-[13px] leading-relaxed text-brand-text-soft">
          Pague no balcão da serventia. Assim que a chave Pix estiver
          cadastrada, o QR aparece aqui.
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- others */

function CalmCard() {
  return (
    <div className="flex animate-notice-rise flex-col gap-3.5 rounded-2xl border border-brand-border bg-brand-card p-5 shadow-[0_1px_2px_rgba(20,40,25,.05)]">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint">
          <Icon
            name="clock"
            className="h-5 w-5 text-brand-accent"
            strokeWidth={1.8}
          />
        </span>
        <div>
          <div className="text-[15px] font-semibold">Pode ficar tranquilo</div>
          <div className="text-[13.5px] text-brand-muted">
            Avisamos você a cada novidade.
          </div>
        </div>
      </div>
      <div className="h-px bg-brand-border" />
      <p className="text-sm leading-relaxed text-brand-muted">
        Quando terminarmos, o documento aparece aqui e fica disponível por{" "}
        <strong className="text-brand-text">30 dias</strong>. Se precisarmos de
        algo, avisamos nesta mesma página.
      </p>
    </div>
  );
}

function DoneCard({
  result,
  protocolNumber,
  accessKey,
}: {
  result: ServiceRequestDetail;
  protocolNumber: string;
  accessKey: string;
}) {
  return (
    <div
      className={`flex animate-notice-rise flex-col gap-3.5 rounded-2xl border-[1.5px] ${DONE_BORDER} bg-brand-card p-5 shadow-[0_1px_2px_rgba(20,40,25,.05)]`}
    >
      <div className="text-xs font-bold uppercase tracking-[0.16em] text-brand-accent-ink">
        Seu documento
      </div>
      {result.deliveredDocuments.map((doc) => (
        <form
          key={doc.id}
          action="/protocolo/documento"
          method="post"
          className="flex items-center gap-3 rounded-xl border border-brand-border px-3.5 py-3"
        >
          <Icon
            name="file"
            className="h-5 w-5 shrink-0 text-brand-accent"
            strokeWidth={1.8}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14.5px] font-semibold">
              {doc.displayName}
            </div>
            <div className="text-[12.5px] text-brand-muted">
              disponível até {formatDate(addCalendarDays(doc.createdAt, 30))}
            </div>
          </div>
          <input type="hidden" name="protocolNumber" value={protocolNumber} />
          <input type="hidden" name="accessKey" value={accessKey} />
          <input type="hidden" name="attachmentId" value={doc.id} />
          <button
            type="submit"
            className="btn btn-primary min-h-11 px-4 py-2.5 text-sm"
          >
            Baixar
          </button>
        </form>
      ))}
    </div>
  );
}

function RejectedCard() {
  return (
    <div
      className={`flex animate-notice-rise flex-col gap-2.5 rounded-2xl border-[1.5px] ${REJECTED_BORDER} ${REJECTED_BG} p-5`}
    >
      <div className="text-xs font-bold uppercase tracking-[0.16em] text-brand-alert">
        Pedido não aceito
      </div>
      <p className="text-[14.5px] leading-relaxed">
        Enviamos o motivo para você. Se ficou alguma dúvida, fale com a gente
        pelo atendimento online ou no balcão. Estamos aqui para ajudar.
      </p>
    </div>
  );
}

function ResolvedRequirement({
  requirement,
}: {
  requirement: RequirementView;
}) {
  return (
    <div className="mt-1.5 flex flex-col gap-2.5">
      <div className="text-xs font-bold uppercase tracking-[0.16em] text-brand-accent-ink">
        Já resolvido
      </div>
      <div className="flex flex-col gap-1.5 rounded-xl border border-brand-border bg-brand-card p-3.5 opacity-85">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-brand-tint px-2.5 py-[3px] text-[11px] font-bold text-brand-primary-soft">
            Resolvido
          </span>
          <span className="text-xs text-brand-faint">
            pedido em {formatDate(requirement.createdAt)}
            {requirement.fulfilledAt
              ? ` · resolvido em ${formatDate(requirement.fulfilledAt)}`
              : ""}
          </span>
        </div>
        <p className="text-sm leading-relaxed">{requirement.text}</p>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- files */

function FilesSection({
  result,
  hasSignedForm,
  citizenDocuments,
  onDocument,
}: {
  result: ServiceRequestDetail;
  hasSignedForm: boolean;
  citizenDocuments: CitizenDocumentView[];
  onDocument: (docs: CitizenDocumentView[]) => void;
}) {
  const [state, action, pending] = useActionState<
    AttachDocumentState,
    FormData
  >(attachExtraDocument, { status: "idle" });
  const { send, uploading, error } = useAttachmentUpload(action);
  const sending = pending || uploading;
  const canAttachExtra =
    result.requestStatus !== "rejected" &&
    result.requestStatus !== "cancelled" &&
    result.deliveredDocuments.length === 0;

  useEffect(() => {
    if (state.status === "success") onDocument(state.documents);
  }, [state, onDocument]);

  return (
    <div className="flex flex-col">
      <div className="border-b-[1.5px] border-brand-text pb-3.5">
        <h2 className="font-serif text-[clamp(19px,2.6vw,26px)] font-semibold text-brand-primary">
          Seus arquivos
        </h2>
      </div>

      <form
        action="/solicitar/requerimento"
        method="post"
        target="_blank"
        rel="noopener"
        className="flex items-center gap-3 border-b border-brand-border py-4"
      >
        <Icon
          name="file"
          className="h-[18px] w-[18px] shrink-0 text-brand-accent"
          strokeWidth={1.8}
        />
        <div className="flex-1">
          <div className="text-[15px] font-semibold">
            Formulário do pedido (PDF)
          </div>
          <div className="text-[13px] text-brand-muted">
            criado com os dados do seu pedido · {formatDate(result.createdAt)}
          </div>
        </div>
        <input
          type="hidden"
          name="protocolNumber"
          value={result.protocolNumber}
        />
        <input type="hidden" name="accessKey" value={result.accessKey} />
        <button type="submit" className="btn btn-ghost btn-sm">
          Ver
        </button>
      </form>

      {hasSignedForm && (
        <div className="flex items-center gap-3 border-b border-brand-border py-4">
          <Icon
            name="file"
            className="h-[18px] w-[18px] shrink-0 text-brand-accent"
            strokeWidth={1.8}
          />
          <div className="flex-1">
            <div className="text-[15px] font-semibold">Formulário assinado</div>
            <div className="text-[13px] text-brand-muted">
              enviado por você em{" "}
              {formatDateTime(result.signedFormReceivedAt ?? result.createdAt)}
            </div>
          </div>
          {result.signedFormAttachmentId && (
            <form action="/protocolo/documento" method="post">
              <input
                type="hidden"
                name="protocolNumber"
                value={result.protocolNumber}
              />
              <input type="hidden" name="accessKey" value={result.accessKey} />
              <input
                type="hidden"
                name="attachmentId"
                value={result.signedFormAttachmentId}
              />
              <button type="submit" className="btn btn-ghost btn-sm">
                Ver
              </button>
            </form>
          )}
        </div>
      )}

      {citizenDocuments.map((doc) => (
        <form
          key={doc.id}
          action="/protocolo/documento"
          method="post"
          className="flex items-center gap-3 border-b border-brand-border py-4"
        >
          <Icon
            name="file"
            className="h-[18px] w-[18px] shrink-0 text-brand-accent"
            strokeWidth={1.8}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold">
              {doc.displayName}
            </div>
            <div className="text-[13px] text-brand-muted">
              enviado em {formatDate(doc.createdAt)}
            </div>
          </div>
          <input
            type="hidden"
            name="protocolNumber"
            value={result.protocolNumber}
          />
          <input type="hidden" name="accessKey" value={result.accessKey} />
          <input type="hidden" name="attachmentId" value={doc.id} />
          <button type="submit" className="btn btn-ghost btn-sm">
            Baixar
          </button>
        </form>
      ))}

      {canAttachExtra && (
        <div className="flex flex-col gap-2 pt-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(event.currentTarget, "documento", 1);
            }}
          >
            <input
              type="hidden"
              name="protocolNumber"
              value={result.protocolNumber}
            />
            <input type="hidden" name="accessKey" value={result.accessKey} />
            <label
              className={`flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-[11px] border-[1.5px] border-dashed border-brand-border px-3 py-3 text-center text-[14.5px] font-semibold text-brand-primary ${sending ? "opacity-60" : "hover:bg-brand-card"}`}
            >
              <span className="text-brand-accent">
                <Icon name="plus" className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
              {sending ? "Enviando..." : "Enviar outro arquivo"}
              <input
                type="file"
                name="documento"
                accept={ATTACHMENT_ACCEPT}
                className="sr-only"
                disabled={sending}
                onChange={(event) => {
                  if (event.target.files?.length)
                    event.target.form?.requestSubmit();
                }}
              />
            </label>
          </form>
          {(error || state.status === "error") && (
            <output className="text-[12.5px] font-semibold text-brand-alert">
              {error ?? (state.status === "error" && state.message)}
            </output>
          )}
          <span className="text-[13px] text-brand-muted">
            Se precisarmos de mais algum documento, envie por aqui. Ele chega
            direto no seu pedido.
          </span>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- detail */

function ServiceRequestTrilho({
  initial,
  onReset,
}: {
  initial: ServiceRequestDetail;
  onReset: () => void;
}) {
  const [hasSignedForm, setHasSignedForm] = useState(initial.hasSignedForm);
  const [citizenDocuments, setCitizenDocuments] = useState(
    initial.citizenDocuments,
  );
  // Lifted out of the snapshot: a reply sent from a RequirementCard below
  // has to land back here, or it renders once (inside that card's own
  // optimistic state) and disappears the moment this component re-renders.
  const [requirements, setRequirements] = useState(initial.requirements);
  const [detailsOpen, setDetailsOpen] = useState(true);
  // A fresher snapshot (see LookupFlow's polling) replaces what the citizen
  // sees but not what they are typing: the cards below keep their drafts.
  useEffect(() => {
    setHasSignedForm(initial.hasSignedForm);
    setCitizenDocuments(initial.citizenDocuments);
    setRequirements(initial.requirements);
  }, [initial]);
  const result: ServiceRequestDetail = { ...initial, requirements };

  const rejected =
    result.requestStatus === "rejected" || result.requestStatus === "cancelled";
  const finished =
    result.deliveredDocuments.length > 0 ||
    result.requestStatus === "done" ||
    result.requestStatus === "archived";
  const pendingRequirements = result.requirements.filter(
    (r) => r.status === "pending",
  );
  const resolvedRequirements = result.requirements.filter(
    (r) =>
      r.status === "fulfilled" &&
      (r.messages.length > 0 || r.resolutionFileName),
  );
  const awaitingPay = Boolean(result.amountLabel) && !result.paymentSettled;
  const showSign = !hasSignedForm && !rejected;
  const showPay =
    awaitingPay &&
    hasSignedForm &&
    pendingRequirements.length === 0 &&
    !rejected;
  const showCalm =
    hasSignedForm &&
    !rejected &&
    !finished &&
    pendingRequirements.length === 0 &&
    !awaitingPay;

  const steps = computeSteps(result, hasSignedForm, rejected, finished);
  const pill = computePill(
    result,
    hasSignedForm,
    rejected,
    finished,
    pendingRequirements.length > 0,
    awaitingPay,
  );
  const { headline, leadDate, leadText } = computeHeadline(
    result,
    hasSignedForm,
    rejected,
    finished,
    pendingRequirements[pendingRequirements.length - 1],
    awaitingPay,
  );
  const { prazoStrong, prazoText } = computePrazo(result, rejected, finished);
  const groups = groupHistory(buildHistory(result, hasSignedForm, rejected));

  return (
    <div className="flex flex-col gap-8 md:gap-14">
      <div className="flex flex-col items-center gap-2.5 text-center">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-brand-accent-ink">
          Andamento do pedido
        </span>
        <h1 className="font-serif text-[clamp(30px,6vw,48px)] leading-[1.04] font-semibold tracking-[-0.01em] text-brand-primary">
          {result.protocolNumber}
        </h1>
        <p className="max-w-prose text-[clamp(13px,1.6vw,16px)] leading-relaxed text-brand-muted text-balance">
          {result.actName} · {result.attributionName}
        </p>
        <span
          className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold ${toneText(pill.tone)} ${
            pill.tone === "red"
              ? REJECTED_BG
              : pill.tone === "gold"
                ? "bg-brand-accent-soft"
                : "bg-brand-tint"
          }`}
        >
          <span className="h-[7px] w-[7px] rounded-full bg-current" />
          {pill.label}
        </span>
      </div>

      <ProgressRail steps={steps} />
      <ProgressDots steps={steps} rejected={rejected} />

      <div className="grid items-start gap-8 md:grid-cols-2 md:gap-11">
        <div className="flex min-w-0 flex-col gap-4.5">
          <h2 className="font-serif text-[clamp(23px,3vw,30px)] leading-[1.15] font-semibold text-brand-primary text-balance">
            {headline}
          </h2>
          <p className="text-[15.5px] leading-relaxed">
            <strong>{leadDate}</strong> {leadText}
          </p>
          <p className="text-sm leading-relaxed text-brand-muted">
            <strong className="text-brand-text">{prazoStrong}</strong>
            {prazoText}
          </p>
          {resolvedRequirements.map((r) => (
            <ResolvedRequirement key={r.id} requirement={r} />
          ))}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {showSign && (
            <SignCard
              protocolNumber={result.protocolNumber}
              accessKey={result.accessKey}
              onSigned={() => setHasSignedForm(true)}
            />
          )}
          {pendingRequirements.map((r) => (
            <RequirementCard
              key={r.id}
              requirement={r}
              protocolNumber={result.protocolNumber}
              accessKey={result.accessKey}
              onSent={(message) =>
                setRequirements((prev) =>
                  prev.map((req) =>
                    req.id === r.id
                      ? { ...req, messages: [...req.messages, message] }
                      : req,
                  ),
                )
              }
            />
          ))}
          {showPay && <PayCard result={result} />}
          {showCalm && <CalmCard />}
          {finished && (
            <DoneCard
              result={result}
              protocolNumber={result.protocolNumber}
              accessKey={result.accessKey}
            />
          )}
          {rejected && <RejectedCard />}
        </div>
      </div>

      <div className="flex flex-col">
        <button
          type="button"
          onClick={() => setDetailsOpen((v) => !v)}
          className="flex w-full items-center justify-between border-b-[1.5px] border-brand-text bg-transparent pb-3.5 text-left"
        >
          <h2 className="font-serif text-[clamp(19px,2.6vw,26px)] font-semibold text-brand-primary">
            Histórico
          </h2>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-brand-text transition-transform duration-300 ${detailsOpen ? "" : "rotate-180"}`}
            aria-hidden="true"
          >
            <path d="m6 15 6-6 6 6" />
          </svg>
        </button>
        {detailsOpen &&
          groups.map((g) => (
            <div
              key={g.day}
              className="flex flex-wrap gap-x-6 gap-y-2 border-b border-brand-border py-5 last:border-b-0"
            >
              <div
                className={`w-full flex-none text-[15px] font-semibold sm:w-[220px] ${toneText(g.tone)}`}
              >
                {g.day}
              </div>
              <div className="flex min-w-[260px] flex-1 flex-col gap-3.5">
                {g.events.map((e, i) => (
                  <div key={`${e.title}-${i}`}>
                    <div
                      className={`text-[15px] font-semibold ${toneText(e.tone)}`}
                    >
                      {e.title}
                    </div>
                    <div className="mt-0.5 text-sm text-brand-muted">
                      {formatTime(e.at)}
                      {e.sub ? ` · ${e.sub}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>

      <FilesSection
        result={result}
        hasSignedForm={hasSignedForm}
        citizenDocuments={citizenDocuments}
        onDocument={(docs) => setCitizenDocuments((prev) => [...prev, ...docs])}
      />

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-t border-brand-border pt-[clamp(28px,4vw,40px)]">
        <div className="flex flex-1 basis-64 flex-col gap-1">
          <div className="text-[15px] font-semibold">
            Tem outro pedido para acompanhar?
          </div>
          <div className="text-[13.5px] leading-relaxed text-brand-muted">
            Digite o número do protocolo e veja o andamento.
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="btn btn-primary min-h-12 px-5 py-3 text-[14.5px]"
        >
          <Icon name="search" className="h-4 w-4" strokeWidth={2} />
          Consultar outro pedido
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- flow */

function LookupFlow({
  initialNumber,
  onReset,
}: {
  initialNumber?: string;
  onReset: () => void;
}) {
  const [state, formAction, pending] = useActionState<LookupState, FormData>(
    lookupProtocolDetail,
    { status: "idle" },
  );
  // The consult the person made, refreshed in place whenever the office
  // writes to the record. Kept apart from `state`: a refresh that fails
  // (network, rate limit) must not throw the citizen back to the gate.
  const [live, setLive] = useState<ProtocolDetail>();
  const detail = live ?? (state.status === "success" ? state : undefined);

  useLiveVersion(
    () =>
      detail
        ? protocolVersion(detail.protocolNumber, detail.accessKey)
        : Promise.resolve(null),
    detail?.updatedAt,
    async () => {
      if (!detail) return;
      const form = new FormData();
      form.set("protocolNumber", detail.protocolNumber);
      form.set("accessKey", detail.accessKey);
      const next = await lookupProtocolDetail({ status: "idle" }, form);
      if (next.status === "success") setLive(next);
    },
    15_000,
  );

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col px-4 py-8 md:px-10 md:py-16">
      {detail?.kind === "service-request" ? (
        <ServiceRequestTrilho initial={detail} onReset={onReset} />
      ) : detail?.kind === "data-rights" ? (
        <DataRightsCard result={detail} onNewConsult={onReset} />
      ) : detail ? (
        <OmbudsmanCard result={detail} onNewConsult={onReset} />
      ) : (
        <Gate
          initialNumber={initialNumber}
          action={formAction}
          pending={pending}
          error={state.status === "error" ? state.message : undefined}
        />
      )}
    </div>
  );
}

export function ProtocolTrilho({ initialNumber }: { initialNumber?: string }) {
  const [resetKey, setResetKey] = useState(0);
  return (
    <LookupFlow
      key={resetKey}
      initialNumber={resetKey === 0 ? initialNumber : undefined}
      onReset={() => setResetKey((k) => k + 1)}
    />
  );
}
