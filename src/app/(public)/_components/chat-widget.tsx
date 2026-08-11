"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { isWithinChatHours, nextChatOpening } from "@/core/chat/hours.ts";
import { formatFullDate } from "@/core/scheduling/calendar.ts";
import { SECTION_ROUTES } from "@/core/tenant/gating.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { Icon } from "./icon.tsx";

const CONVERSATION_ID_STORAGE_KEY = "chat:conversationId";
const MESSAGE_POLL_MS = 4000;
const STATUS_POLL_MS = 15000;

interface MessageView {
  id: string;
  authorType: "citizen" | "staff" | "system" | "note";
  body: string;
  attachment: { displayName: string | null } | null;
  createdAt: string;
}

interface ConversationView {
  id: string;
  status: "waiting" | "active" | "closed";
  closedReason: string | null;
  attendantName?: string;
  attendantSector?: string;
  queuePosition?: number;
  needsInactivityWarning: boolean;
}

type PanelView =
  | { kind: "closed" }
  | { kind: "prechat" }
  | { kind: "hours" }
  | { kind: "conversation" }
  | { kind: "rating" };

// Network failures and non-JSON responses both come back the same way, as
// an `{ error: "network" }` payload, so every caller can read `data.error`
// without its own try/catch around the fetch itself.
async function postForm(url: string, body: FormData) {
  try {
    const response = await fetch(url, { method: "POST", body });
    return await response.json();
  } catch {
    return { error: "network" };
  }
}

function describePrechatError(code: string): string {
  switch (code) {
    case "invalid":
      return "Confira os campos destacados.";
    case "rate_limited":
      return "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.";
    case "closed":
      return "O atendimento encerrou agora há pouco. Tente novamente durante o horário de atendimento.";
    case "network":
      return "Sem conexão com a internet. Verifique e tente de novo.";
    default:
      return "Não foi possível iniciar o atendimento agora. Tente novamente em instantes.";
  }
}

function describeSendError(code: string, message?: string): string {
  switch (code) {
    case "invalid":
      return message || "Confira sua mensagem e tente de novo.";
    case "rate_limited":
      return "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.";
    case "closed":
      return "Este atendimento foi encerrado.";
    case "not_found":
      return "Não encontramos mais este atendimento. Feche a janela e comece um novo.";
    case "network":
      return "Sem conexão com a internet. Verifique e tente de novo.";
    default:
      return "Não foi possível enviar sua mensagem agora. Tente novamente em instantes.";
  }
}

const CLOSE_ERROR =
  "Não foi possível encerrar agora. Tente novamente em instantes.";
const RATING_ERROR =
  "Não foi possível enviar sua avaliação agora. Tente novamente em instantes.";

export function ChatWidget({ tenant }: { tenant: Tenant }) {
  const pathname = usePathname();
  const [available, setAvailable] = useState({
    enabled: true,
    withinHours: isWithinChatHours(tenant, new Date()),
  });
  const [panel, setPanel] = useState<PanelView>({ kind: "closed" });
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationView | null>(
    null,
  );
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [matchedProtocolNumber, setMatchedProtocolNumber] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const lastMessageAt = useRef<string | undefined>(undefined);

  // Restores a conversation the citizen already had, from a non-sensitive id
  // kept in localStorage — the actual proof of ownership is the httpOnly
  // cookie the server checks, this is only a pointer to poll.
  useEffect(() => {
    const stored = window.localStorage.getItem(CONVERSATION_ID_STORAGE_KEY);
    if (stored) setConversationId(stored);
  }, []);

  // Whether the office's chat is on and inside hours, polled on its own so
  // switching it off removes the button within a few seconds.
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const response = await fetch("/api/chat/status");
        if (!response.ok || cancelled) return;
        const data = await response.json();
        if (!cancelled) setAvailable(data);
      } catch {
        // A transient network hiccup leaves the last known state on screen.
      }
    }
    poll();
    const interval = setInterval(poll, STATUS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Tracked in a ref, not just derived from `panel` at render time: the
  // polling callback below is memoized with an empty dependency array (so
  // the interval it's given to is not torn down and rebuilt every render),
  // and a ref is what lets that closure still read the *current* panel
  // instead of the one from the render it was created in.
  const panelKindRef = useRef(panel.kind);
  useEffect(() => {
    panelKindRef.current = panel.kind;
    if (panel.kind !== "closed") setUnreadCount(0);
  }, [panel.kind]);

  const refreshConversation = useCallback(async (id: string) => {
    const after = lastMessageAt.current;
    const url = after
      ? `/api/chat/${id}?after=${encodeURIComponent(after)}`
      : `/api/chat/${id}`;
    const response = await fetch(url);
    if (response.status === 404) {
      window.localStorage.removeItem(CONVERSATION_ID_STORAGE_KEY);
      setConversationId(null);
      setConversation(null);
      return;
    }
    if (!response.ok) return;
    const data = await response.json();
    setConversation(data.conversation);
    if (data.messages.length > 0) {
      lastMessageAt.current = data.messages.at(-1).createdAt;
      // The `after` cursor is a millisecond ISO string round-tripped from a
      // microsecond-precision Postgres timestamp, so it can fail to exclude
      // the very row it came from — the same message would then come back
      // on every poll. De-duping by id here is what actually guarantees no
      // repeats, regardless of that precision loss.
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [
          ...prev,
          ...data.messages.filter((m: MessageView) => !seen.has(m.id)),
        ];
      });
      setUnreadCount((prevCount) =>
        panelKindRef.current === "closed"
          ? prevCount + data.messages.length
          : 0,
      );
    }
    // Only jumps to the rating screen when the citizen already has the
    // conversation open — a conversation closed in the background (staff, or
    // inactivity) while the panel itself is closed should raise the unread
    // badge above, not pop the panel open uninvited.
    if (
      data.conversation.status === "closed" &&
      panelKindRef.current !== "closed" &&
      panelKindRef.current !== "rating"
    ) {
      setPanel({ kind: "rating" });
    }
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    refreshConversation(conversationId);
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      refreshConversation(conversationId);
    }, MESSAGE_POLL_MS);
    return () => clearInterval(interval);
  }, [conversationId, refreshConversation]);

  function openWidget() {
    if (!available.withinHours) {
      setPanel({ kind: "hours" });
      return;
    }
    if (conversationId) {
      setPanel(
        conversation?.status === "closed"
          ? { kind: "rating" }
          : { kind: "conversation" },
      );
      return;
    }
    setPanel({ kind: "prechat" });
  }

  // Contract: any page can open the widget by dispatching this event, without
  // importing the widget itself — used by the Contato page's "Atendimento
  // online" button.
  useEffect(() => {
    function handleOpenChat() {
      openWidget();
    }
    window.addEventListener("veridia:open-chat", handleOpenChat);
    return () =>
      window.removeEventListener("veridia:open-chat", handleOpenChat);
  });

  async function submitPrechat(formData: FormData) {
    setSending(true);
    setError(null);
    formData.set("sourcePath", pathname);
    try {
      const data = await postForm("/api/chat", formData);
      if (data.error) {
        setError(describePrechatError(data.error));
        return;
      }
      if (!data.id) {
        // Honeypot: the screen advances as if it worked, nothing was saved.
        setPanel({ kind: "conversation" });
        return;
      }
      window.localStorage.setItem(CONVERSATION_ID_STORAGE_KEY, data.id);
      setConversationId(data.id);
      setMatchedProtocolNumber(data.matchedProtocolNumber);
      setPanel({ kind: "conversation" });
    } finally {
      setSending(false);
    }
  }

  async function sendMessage(formData: FormData) {
    if (!conversationId) return;
    setSending(true);
    setError(null);
    try {
      const data = await postForm(`/api/chat/${conversationId}`, formData);
      if (data.error) {
        setError(describeSendError(data.error, data.message));
        return;
      }
      await refreshConversation(conversationId);
    } finally {
      setSending(false);
    }
  }

  async function closeConversation() {
    if (!conversationId) return;
    setActionPending(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("intent", "close");
      const data = await postForm(`/api/chat/${conversationId}`, formData);
      if (data.error) {
        setError(CLOSE_ERROR);
        return;
      }
      await refreshConversation(conversationId);
    } finally {
      setActionPending(false);
    }
  }

  async function submitRating(formData: FormData) {
    if (!conversationId) return;
    setActionPending(true);
    setError(null);
    try {
      formData.set("intent", "rate");
      const data = await postForm(`/api/chat/${conversationId}`, formData);
      if (data.error) {
        setError(RATING_ERROR);
        return;
      }
      window.localStorage.removeItem(CONVERSATION_ID_STORAGE_KEY);
      setConversationId(null);
      setConversation(null);
      setMessages([]);
      lastMessageAt.current = undefined;
      setPanel({ kind: "closed" });
    } finally {
      setActionPending(false);
    }
  }

  if (!available.enabled) return null;

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3 md:right-8 md:bottom-8">
      {panel.kind !== "closed" && (
        <div className="flex h-[min(70vh,560px)] w-[calc(100vw-2rem)] max-w-[390px] flex-col overflow-hidden rounded-2xl border border-brand-border bg-brand-card shadow-2xl">
          <div className="flex items-center gap-2.5 bg-brand-primary px-4.5 py-3.5 text-white">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white/15">
              <Icon name="chat" className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-serif text-[15.5px] font-semibold">
                Atendimento online
              </span>
              {panel.kind === "conversation" && conversation && (
                <span className="flex items-center gap-1.5 text-[12px] opacity-90">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  {conversation.status === "waiting"
                    ? "Aguardando atendente"
                    : conversation.attendantName
                      ? `${conversation.attendantName}${conversation.attendantSector ? ` · ${conversation.attendantSector}` : ""}`
                      : "Em atendimento"}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setPanel({ kind: "closed" })}
              aria-label="Fechar"
              className="rounded-lg p-1 opacity-80 hover:opacity-100"
            >
              <Icon name="x" className="h-4.5 w-4.5" />
            </button>
          </div>

          {panel.kind === "prechat" && (
            <PrechatForm
              pending={sending}
              error={error}
              onSubmit={submitPrechat}
            />
          )}

          {panel.kind === "hours" && <HoursClosedView tenant={tenant} />}

          {panel.kind === "conversation" && (
            <ConversationView
              conversation={conversation}
              messages={messages}
              matchedProtocolNumber={matchedProtocolNumber}
              pending={sending}
              error={error}
              actionPending={actionPending}
              onSend={sendMessage}
              onGiveUp={closeConversation}
              onClose={closeConversation}
            />
          )}

          {panel.kind === "rating" && (
            <RatingView
              conversation={conversation}
              onSubmit={submitRating}
              pending={actionPending}
              error={error}
            />
          )}
        </div>
      )}

      <button
        type="button"
        onClick={openWidget}
        className="relative inline-flex items-center gap-2 rounded-full bg-brand-primary px-5 py-3.5 font-semibold text-[13.5px] text-white shadow-lg hover:bg-brand-primary-soft"
      >
        <Icon
          name={available.withinHours ? "chat" : "clock"}
          className="h-4 w-4"
        />
        {available.withinHours
          ? "Atendimento online"
          : "Fora do horário de atendimento"}
        {available.withinHours && unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1 flex h-[22px] min-w-[22px] items-center justify-center rounded-full border-2 border-brand-card bg-brand-accent px-1 text-[12px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}

function PrechatForm({
  pending,
  error,
  onSubmit,
}: {
  pending: boolean;
  error: string | null;
  onSubmit: (formData: FormData) => void;
}) {
  return (
    <form
      action={onSubmit}
      className="flex flex-1 flex-col gap-3 overflow-y-auto p-4.5"
    >
      <p className="text-[13.5px] text-brand-muted">
        Como podemos ajudar? Preencha para falar com a equipe.
      </p>
      {/* Invisible to a person, filled only by a script — see support-chat
          spec, "Pré-chat obrigatório antes da fila". */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute h-0 w-0 opacity-0"
      />
      <FormField label="Nome completo" name="name" required />
      <FormField
        label="E-mail ou WhatsApp"
        name="contact"
        required
        hint="Usamos para retorno e envio da transcrição."
      />
      <FormField label="Assunto" name="subject" required />
      <FormField
        label="Protocolo (se tiver)"
        name="informedProtocolNumber"
        required={false}
      />
      {error && (
        <p className="text-[12.5px] font-semibold text-red-700">{error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary btn-lg"
      >
        {pending ? "Enviando..." : "Entrar na fila de atendimento"}
      </button>
      <p className="text-[11px] text-brand-faint">
        Seus dados são usados apenas para este atendimento.
      </p>
    </form>
  );
}

function FormField({
  label,
  name,
  required,
  hint,
}: {
  label: string;
  name: string;
  required: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-bold text-brand-primary">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      <input
        name={name}
        required={required}
        className="w-full rounded-[10px] border border-brand-border bg-brand-surface px-3.5 py-2.5 text-[14px] text-brand-text outline-none focus:border-brand-accent"
      />
      {hint && (
        <span className="mt-1 block text-[11.5px] text-brand-faint">
          {hint}
        </span>
      )}
    </label>
  );
}

function HoursClosedView({ tenant }: { tenant: Tenant }) {
  const opening = nextChatOpening(tenant, new Date());
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4.5">
      <div className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint">
          <Icon name="clock" className="h-5.5 w-5.5 text-brand-accent" />
        </div>
        <p className="font-serif text-[17px] font-semibold text-brand-primary">
          Estamos fechados agora
        </p>
        <p className="mt-1 text-[13px] text-brand-muted">
          {tenant.openingHours}
        </p>
      </div>
      <div className="flex items-center gap-2.5 rounded-xl border border-brand-border bg-brand-tint px-3.5 py-3 text-[13px] font-semibold text-brand-primary">
        <Icon name="clock" className="h-4 w-4" />
        Voltamos {formatFullDate(opening.day).toLowerCase()} às {opening.hour}h
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-accent">
          Enquanto isso
        </span>
        <a
          href={`mailto:${tenant.contacts.email}`}
          className="btn btn-secondary btn-lg justify-start"
        >
          <Icon name="phone" className="h-4 w-4" />
          {tenant.contacts.email}
        </a>
        <a
          href={SECTION_ROUTES["consulta-protocolo"]}
          className="btn btn-secondary btn-lg justify-start"
        >
          <Icon name="search" className="h-4 w-4" />
          Acompanhar um pedido pelo protocolo
        </a>
        <a
          href={SECTION_ROUTES.agendamento}
          className="btn btn-secondary btn-lg justify-start"
        >
          <Icon name="calendar" className="h-4 w-4" />
          Pedir um horário de atendimento
        </a>
      </div>
      <p className="text-[11.5px] text-brand-faint">
        Não recebemos recados fora do horário: assim, ninguém fica sem resposta.
      </p>
    </div>
  );
}

function ConversationView({
  conversation,
  messages,
  matchedProtocolNumber,
  pending,
  error,
  actionPending,
  onSend,
  onGiveUp,
  onClose,
}: {
  conversation: ConversationView | null;
  messages: MessageView[];
  matchedProtocolNumber: string | null;
  pending: boolean;
  error: string | null;
  actionPending: boolean;
  onSend: (formData: FormData) => void;
  onGiveUp: () => void;
  onClose: () => void;
}) {
  // The conversation itself only lands a moment after the widget opens with
  // an id remembered from a previous visit (see the `refreshConversation`
  // effect above) — until then there is nothing to show but a connecting
  // state, not an empty chat.
  if (!conversation) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-tint">
          <Icon name="clock" className="h-5 w-5 text-brand-primary" />
        </span>
        <p className="font-serif text-[17px] font-semibold text-brand-primary">
          Conectando...
        </p>
      </div>
    );
  }

  if (conversation.status === "waiting") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-tint">
          <Icon name="clock" className="h-5 w-5 text-brand-primary" />
        </span>
        <p className="font-serif text-[17px] font-semibold text-brand-primary">
          {conversation.queuePosition
            ? `Você é o ${conversation.queuePosition}º da fila`
            : "Você está na fila"}
        </p>
        <p className="text-[13px] text-brand-muted">
          Mantenha esta janela aberta.
        </p>
        {matchedProtocolNumber && (
          <p className="inline-flex items-center gap-1.5 rounded-lg bg-brand-tint px-3 py-1.5 text-[12.5px] font-semibold text-brand-primary">
            <Icon name="check" className="h-3.5 w-3.5" />
            Pedido {matchedProtocolNumber} localizado
          </p>
        )}
        <button
          type="button"
          onClick={onGiveUp}
          disabled={actionPending}
          className="btn btn-secondary btn-md mt-1"
        >
          {actionPending ? "Saindo..." : "Desistir da espera"}
        </button>
        {error && (
          <p className="text-[12px] font-semibold text-red-700">{error}</p>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto bg-brand-surface p-3.5">
        {conversation.needsInactivityWarning && (
          <div className="self-center rounded-full bg-brand-tint px-3 py-1 text-center text-[11.5px] text-brand-primary">
            Ainda está aí? Sem resposta em alguns minutos, o atendimento é
            encerrado.
          </div>
        )}
        {messages.length === 0 && (
          <p className="self-center pt-2 text-center text-[12.5px] text-brand-faint">
            Escreva sua mensagem para começar a conversa.
          </p>
        )}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>
      <form
        action={onSend}
        className="flex items-center gap-2 border-t border-brand-border bg-brand-card p-3"
      >
        <label className="flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-[10px] border border-brand-border text-brand-primary">
          <Icon name="paperclip" className="h-4.5 w-4.5" />
          <input
            type="file"
            name="attachment"
            className="sr-only"
            disabled={pending}
            onChange={(event) => event.target.form?.requestSubmit()}
          />
        </label>
        <input
          name="body"
          placeholder="Escreva sua mensagem..."
          className="min-w-0 flex-1 rounded-[10px] border border-brand-border bg-brand-surface px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand-accent"
        />
        <button
          type="submit"
          disabled={pending}
          aria-label={pending ? "Enviando mensagem..." : "Enviar mensagem"}
          aria-busy={pending}
          className="flex h-11 w-11 flex-none items-center justify-center rounded-[10px] bg-brand-primary text-white disabled:opacity-70"
        >
          <Icon name="send" className="h-4 w-4" />
        </button>
      </form>
      {error && (
        <p className="bg-brand-card px-3.5 pb-2 text-center text-[11.5px] font-semibold text-red-700">
          {error}
        </p>
      )}
      <div className="border-t border-brand-border bg-brand-card px-3.5 py-2.5 text-center">
        <button
          type="button"
          onClick={onClose}
          disabled={actionPending}
          className="btn btn-ghost btn-sm"
        >
          {actionPending ? "Encerrando..." : "Encerrar conversa"}
        </button>
      </div>
    </>
  );
}

function MessageBubble({ message }: { message: MessageView }) {
  if (message.authorType === "system") {
    return (
      <div className="self-center rounded-full bg-brand-tint px-3 py-1 text-center text-[11px] text-brand-muted">
        {message.body}
      </div>
    );
  }
  // Notes never reach this component: the server already strips them from
  // the citizen's messages (see src/lib/chat.ts, listMessages).
  const fromCitizen = message.authorType === "citizen";
  return (
    <div
      className={`max-w-[82%] rounded-xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${
        fromCitizen
          ? "self-end rounded-br-sm bg-brand-primary text-white"
          : "self-start rounded-bl-sm border border-brand-border bg-brand-card text-brand-text"
      }`}
    >
      {message.attachment ? (
        <span className="flex items-center gap-2">
          <Icon name="file" className="h-4 w-4 flex-none" />
          {message.attachment.displayName}
        </span>
      ) : (
        message.body
      )}
    </div>
  );
}

function RatingView({
  conversation,
  onSubmit,
  pending,
  error,
}: {
  conversation: ConversationView | null;
  onSubmit: (formData: FormData) => void;
  pending: boolean;
  error: string | null;
}) {
  const [rating, setRating] = useState(0);

  return (
    <form
      action={onSubmit}
      className="flex flex-1 flex-col justify-center gap-4 overflow-y-auto p-4.5"
    >
      <input type="hidden" name="rating" value={rating} />
      <div className="text-center">
        {conversation?.attendantName && (
          <p className="text-[11.5px] text-brand-faint">
            Atendimento encerrado com {conversation.attendantName}
          </p>
        )}
        <p className="mt-1 text-[14px] text-brand-muted">
          Como foi o atendimento?
        </p>
        <div className="mt-2.5 flex justify-center gap-1.5">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              aria-label={`${value} estrelas`}
              className="p-0.5"
            >
              <svg
                viewBox="0 0 24 24"
                width={28}
                height={28}
                fill={value <= rating ? "var(--color-brand-accent)" : "none"}
                stroke={
                  value <= rating
                    ? "var(--color-brand-accent)"
                    : "var(--color-brand-border)"
                }
                strokeWidth={1.5}
                aria-hidden="true"
              >
                <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01Z" />
              </svg>
            </button>
          ))}
        </div>
      </div>
      <textarea
        name="ratingComment"
        rows={2}
        placeholder="Quer deixar um comentário? (opcional)"
        className="w-full rounded-[10px] border border-brand-border bg-brand-surface px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand-accent"
      />
      <label className="flex items-center gap-2.5 text-[13px] text-brand-text">
        <input
          type="checkbox"
          name="wantsTranscriptEmail"
          className="h-4 w-4"
        />
        Receber a transcrição por e-mail
      </label>
      {error && (
        <p className="text-center text-[12.5px] font-semibold text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={rating === 0 || pending}
        className="btn btn-primary btn-lg"
      >
        {pending ? "Enviando..." : "Enviar avaliação"}
      </button>
    </form>
  );
}
