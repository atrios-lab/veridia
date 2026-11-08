"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CITIZEN_REPLY_SOUND,
  CITIZEN_REPLY_VOLUME,
  NUDGE_SOUND,
  newStaffReplies,
} from "@/core/chat/alerts.ts";
import {
  closedByForCitizen,
  emailHelpLine,
  GIVE_UP_DETAIL_MAX,
  GIVE_UP_REASONS,
} from "@/core/chat/closing.ts";
import {
  formatClock,
  isWithinChatHours,
  nextChatOpening,
} from "@/core/chat/hours.ts";
import { isOfficeNudge, nudgeWaitLabel } from "@/core/chat/nudge.ts";
import { formatFullDate } from "@/core/scheduling/calendar.ts";
import { SECTION_ROUTES } from "@/core/tenant/gating.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { playSound, unlockAudio } from "../../_components/chat-sound.ts";
import { shakeElement, vibrate } from "../../_components/shake.ts";
import {
  ATTACHMENT_ACCEPT,
  useAttachmentPrepare,
} from "../_lib/attachments.tsx";
import { Icon } from "./icon.tsx";

const CONVERSATION_ID_STORAGE_KEY = "chat:conversationId";
// Whether the reply sound is on, per browser. Off only when the citizen
// turned it off: a conversation waiting on the office is exactly when the
// sound is wanted.
const REPLY_SOUND_STORAGE_KEY = "chat:replySound";
const MESSAGE_POLL_MS = 4000;
// With the tab in the background the conversation is still checked, so a
// reply can call the citizen back, but every third tick: about 12s.
const HIDDEN_POLL_EVERY = 3;
const TITLE_BLINK_MS = 1000;
// The chat window, which shakes for a "Chamar atenção" either way.
const PANEL_ID = "chat-atendimento";
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
  /** When the citizen's "Chamar atenção" frees up (ISO). */
  nudgeAvailableAt?: string;
}

type PanelView =
  | { kind: "closed" }
  | { kind: "prechat" }
  | { kind: "hours" }
  | { kind: "conversation" }
  // "Por que está encerrando?", asked before the citizen ends or gives up.
  | { kind: "give-up" }
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

export function ChatWidget({
  tenant,
  lookupHref,
}: {
  tenant: Tenant;
  /** Where "follow a request" goes: SECTION_ROUTES["consulta-protocolo"]. */
  lookupHref: string;
}) {
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
  // Every message id already received. The `after` cursor can hand the last
  // one back again (see refreshConversation), so what is new is decided by
  // id here: the unread count and the reply sound count a message once.
  const seenIds = useRef<Set<string>>(new Set());
  // Whether this conversation was loaded once already. Not `after` being
  // empty: a conversation with no message yet keeps an empty cursor, and
  // the office's very first reply, the one most worth a sound, would then
  // read as the first load.
  const loadedOnce = useRef(false);
  // A reply from the office that the citizen has not seen yet: blinks the
  // tab title while the page is in the background, pulses the button while
  // the panel is closed.
  const [replyPending, setReplyPending] = useState(false);
  const [replySound, setReplySound] = useState(true);
  const replySoundRef = useRef(true);
  replySoundRef.current = replySound;
  const [notifyPermission, setNotifyPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");

  useEffect(() => {
    try {
      setReplySound(
        window.localStorage.getItem(REPLY_SOUND_STORAGE_KEY) !== "off",
      );
    } catch {
      // Storage off: the sound stays on.
    }
    setNotifyPermission(
      typeof Notification === "undefined"
        ? "unsupported"
        : Notification.permission,
    );
    // The browser lets a page play sound only after a click or a key; the
    // citizen typing their first message is that, so the reply can ring.
    const unlock = () => void unlockAudio();
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, []);

  function toggleReplySound() {
    const next = !replySound;
    setReplySound(next);
    try {
      window.localStorage.setItem(REPLY_SOUND_STORAGE_KEY, next ? "on" : "off");
    } catch {
      // Applied to this visit only.
    }
    if (next) {
      void unlockAudio().then(() =>
        playSound(CITIZEN_REPLY_SOUND, CITIZEN_REPLY_VOLUME),
      );
    }
  }

  async function askNotifyPermission() {
    if (typeof Notification === "undefined") return;
    setNotifyPermission(await Notification.requestPermission());
  }

  /**
   * The office answered: a soft tone, the tab title, the button, and the
   * browser's notification when the citizen asked for it and is looking
   * elsewhere. The notification never carries the message itself: it shows
   * on a screen that may not be the citizen's alone.
   */
  const announceReply = useCallback(() => {
    if (replySoundRef.current) {
      playSound(CITIZEN_REPLY_SOUND, CITIZEN_REPLY_VOLUME);
    }
    const lookingAtIt =
      document.visibilityState === "visible" &&
      panelKindRef.current === "conversation";
    if (lookingAtIt) return;
    setReplyPending(true);
    if (
      document.visibilityState !== "visible" &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      try {
        const notification = new Notification("Nova resposta do cartório", {
          body: "Você recebeu uma resposta no atendimento online.",
          tag: "chat-reply",
        });
        notification.onclick = () => {
          window.focus();
          setPanel({ kind: "conversation" });
          notification.close();
        };
      } catch {
        // Not allowed outside a service worker here: the sound and the
        // title still carry it.
      }
    }
  }, []);

  // Restores a conversation the citizen already had, from a non-sensitive id
  // kept in localStorage: the actual proof of ownership is the httpOnly
  // cookie the server checks, this is only a pointer to poll.
  useEffect(() => {
    const stored = window.localStorage.getItem(CONVERSATION_ID_STORAGE_KEY);
    if (stored) setConversationId(stored);
  }, []);

  // Whether the office's chat is on and inside hours, polled on its own so
  // switching it off removes the button within a few seconds. Skipped while
  // the tab isn't visible, same discipline as the message poll below: a
  // citizen who leaves the site open in a background tab is not what keeps
  // the server busy.
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
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") poll();
    }, STATUS_POLL_MS);
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

  /**
   * The office pressed "Chamar atenção": the chat opens if it was closed,
   * the window shakes, the phone vibrates and the call's own tone rings,
   * whatever the "Som de aviso" says about ordinary replies.
   */
  const announceNudge = useCallback(() => {
    setPanel({ kind: "conversation" });
    playSound(NUDGE_SOUND, CITIZEN_REPLY_VOLUME);
    vibrate();
    window.setTimeout(
      () => shakeElement(document.getElementById(PANEL_ID)),
      60,
    );
    if (document.visibilityState !== "visible") setReplyPending(true);
  }, []);

  const refreshConversation = useCallback(
    async (id: string) => {
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
      const fresh: MessageView[] = data.messages.filter(
        (m: MessageView) => !seenIds.current.has(m.id),
      );
      for (const m of fresh) seenIds.current.add(m.id);
      if (loadedOnce.current && fresh.some(isOfficeNudge)) {
        announceNudge();
      } else if (newStaffReplies(fresh, !loadedOnce.current) > 0) {
        announceReply();
      }
      loadedOnce.current = true;
      if (data.messages.length > 0) {
        lastMessageAt.current = data.messages.at(-1).createdAt;
        // The `after` cursor is a millisecond ISO string round-tripped from a
        // microsecond-precision Postgres timestamp, so it can fail to exclude
        // the very row it came from: the same message would then come back
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
          panelKindRef.current === "closed" ? prevCount + fresh.length : 0,
        );
      }
      // Only jumps to the rating screen when the citizen already has the
      // conversation open: a conversation closed in the background (staff, or
      // inactivity) while the panel itself is closed should raise the unread
      // badge above, not pop the panel open uninvited.
      if (
        data.conversation.status === "closed" &&
        panelKindRef.current !== "closed" &&
        panelKindRef.current !== "rating"
      ) {
        setPanel({ kind: "rating" });
      }
    },
    [announceReply, announceNudge],
  );

  useEffect(() => {
    if (!conversationId) return;
    refreshConversation(conversationId);
    let tick = 0;
    const interval = setInterval(() => {
      tick++;
      if (
        document.visibilityState !== "visible" &&
        tick % HIDDEN_POLL_EVERY !== 0
      ) {
        return;
      }
      refreshConversation(conversationId);
    }, MESSAGE_POLL_MS);
    return () => clearInterval(interval);
  }, [conversationId, refreshConversation]);

  const [nudgePending, setNudgePending] = useState(false);
  const [nudgeError, setNudgeError] = useState<string | null>(null);

  /** The citizen calls the office; the server holds it to ten minutes. */
  async function sendNudge() {
    if (!conversationId) return;
    setNudgePending(true);
    setNudgeError(null);
    try {
      const form = new FormData();
      form.set("intent", "nudge");
      const response = await fetch(`/api/chat/${conversationId}`, {
        method: "POST",
        body: form,
      });
      const data = await response.json().catch(() => ({}));
      if (data.nudgeAvailableAt) {
        setConversation((current) =>
          current
            ? { ...current, nudgeAvailableAt: data.nudgeAvailableAt }
            : current,
        );
      }
      if (!response.ok) {
        setNudgeError(
          response.status === 429
            ? "Ainda não dá: espere o tempo indicado no botão."
            : "Não foi possível chamar agora. Tente de novo.",
        );
        return;
      }
      shakeElement(document.getElementById(PANEL_ID));
      void refreshConversation(conversationId);
    } catch {
      setNudgeError("Não foi possível chamar agora. Tente de novo.");
    } finally {
      setNudgePending(false);
    }
  }

  // Seeing the conversation is reading the reply.
  useEffect(() => {
    if (panel.kind !== "conversation") return;
    const seen = () => {
      if (document.visibilityState === "visible") setReplyPending(false);
    };
    seen();
    document.addEventListener("visibilitychange", seen);
    return () => document.removeEventListener("visibilitychange", seen);
  }, [panel.kind]);

  // The tab title blinks while a reply waits and the page is in the
  // background, and goes back the moment the citizen returns.
  useEffect(() => {
    if (!replyPending) return;
    const original = document.title;
    let on = false;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        if (on) {
          document.title = original;
          on = false;
        }
        return;
      }
      on = !on;
      document.title = on ? "(1) Nova resposta do cartório" : original;
    }, TITLE_BLINK_MS);
    return () => {
      clearInterval(timer);
      document.title = original;
    };
  }, [replyPending]);

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
  // importing the widget itself: used by the Contato page's "Atendimento
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

  async function closeConversation(reasonForm?: FormData) {
    if (!conversationId) return;
    setActionPending(true);
    setError(null);
    try {
      const formData = reasonForm ?? new FormData();
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
      forgetConversation();
    } finally {
      setActionPending(false);
    }
  }

  /**
   * Leaves a finished conversation behind, rated or not: the next time the
   * button opens, it starts a new one. "Fechar" on the closed screen does
   * this without a rating, so no ending ever leaves the citizen stuck.
   */
  function forgetConversation() {
    window.localStorage.removeItem(CONVERSATION_ID_STORAGE_KEY);
    setConversationId(null);
    setConversation(null);
    setMessages([]);
    lastMessageAt.current = undefined;
    seenIds.current = new Set();
    loadedOnce.current = false;
    setReplyPending(false);
    setPanel({ kind: "closed" });
  }

  if (!available.enabled) return null;

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3 md:right-8 md:bottom-8">
      {panel.kind !== "closed" && (
        <div
          id={PANEL_ID}
          className="flex h-[min(70vh,560px)] w-[calc(100vw-2rem)] max-w-[390px] flex-col overflow-hidden rounded-2xl border border-brand-border bg-brand-card shadow-2xl"
        >
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
              {panel.kind === "conversation" && (
                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]">
                  <button
                    type="button"
                    onClick={toggleReplySound}
                    aria-pressed={replySound}
                    className="underline opacity-90 hover:opacity-100"
                  >
                    {replySound
                      ? "Som de aviso: ligado"
                      : "Som de aviso: desligado"}
                  </button>
                  {notifyPermission === "default" && (
                    <button
                      type="button"
                      onClick={() => void askNotifyPermission()}
                      className="underline opacity-90 hover:opacity-100"
                    >
                      Avisar no navegador
                    </button>
                  )}
                  {notifyPermission === "granted" && (
                    <span className="opacity-90">Aviso no navegador ativo</span>
                  )}
                </span>
              )}
            </span>
            <button
              type="button"
              // On a finished conversation the X ends it too, the same as
              // the "Fechar" button: no way out may leave the citizen stuck
              // on a closed chat the next time they open the bubble.
              onClick={() =>
                panel.kind === "rating"
                  ? forgetConversation()
                  : setPanel({ kind: "closed" })
              }
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

          {panel.kind === "hours" && (
            <HoursClosedView tenant={tenant} lookupHref={lookupHref} />
          )}

          {panel.kind === "conversation" && (
            <ConversationView
              conversation={conversation}
              messages={messages}
              matchedProtocolNumber={matchedProtocolNumber}
              pending={sending}
              error={error}
              actionPending={actionPending}
              onSend={sendMessage}
              onGiveUp={() => setPanel({ kind: "give-up" })}
              onClose={() => setPanel({ kind: "give-up" })}
              nudge={
                <NudgeButton
                  availableAt={conversation?.nudgeAvailableAt}
                  pending={nudgePending}
                  error={nudgeError}
                  onNudge={() => void sendNudge()}
                />
              }
            />
          )}

          {panel.kind === "give-up" && (
            <GiveUpView
              email={tenant.contacts.email}
              pending={actionPending}
              error={error}
              onConfirm={(form) => void closeConversation(form)}
              onBack={() => setPanel({ kind: "conversation" })}
            />
          )}

          {panel.kind === "rating" && (
            <RatingView
              conversation={conversation}
              email={tenant.contacts.email}
              onSubmit={submitRating}
              onDismiss={forgetConversation}
              pending={actionPending}
              error={error}
            />
          )}
        </div>
      )}

      <button
        type="button"
        onClick={openWidget}
        className={`relative inline-flex items-center gap-2 rounded-full bg-brand-primary px-5 py-3.5 font-semibold text-[13.5px] text-white shadow-lg hover:bg-brand-primary-soft ${
          replyPending && panel.kind === "closed"
            ? "motion-safe:animate-attention-pulse"
            : ""
        }`}
      >
        <Icon
          name={available.withinHours ? "chat" : "clock"}
          className="h-4 w-4"
        />
        {available.withinHours
          ? "Atendimento online"
          : "Fora do horário de atendimento"}
        {available.withinHours && unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1 flex h-[22px] min-w-[22px] items-center justify-center rounded-full border-2 border-brand-card bg-brand-accent-ink px-1 text-[12px] font-bold text-white">
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
      {/* Invisible to a person, filled only by a script: see support-chat
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

function HoursClosedView({
  tenant,
  lookupHref,
}: {
  tenant: Tenant;
  lookupHref: string;
}) {
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
        Voltamos {formatFullDate(opening.day).toLowerCase()} às{" "}
        {formatClock(opening)}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-accent-ink">
          Enquanto isso
        </span>
        <a
          href={`mailto:${tenant.contacts.email}`}
          className="btn btn-secondary btn-lg justify-start"
        >
          <Icon name="phone" className="h-4 w-4" />
          {tenant.contacts.email}
        </a>
        <a href={lookupHref} className="btn btn-secondary btn-lg justify-start">
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
  nudge,
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
  /** The "Chamar atenção" button, waiting and attended alike. */
  nudge: React.ReactNode;
}) {
  const { prepare, uploading, error: uploadError } = useAttachmentPrepare();
  const sending = pending || uploading;

  // The conversation itself only lands a moment after the widget opens with
  // an id remembered from a previous visit (see the `refreshConversation`
  // effect above): until then there is nothing to show but a connecting
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
        {nudge}
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
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          // The file goes to the store first, like every other attachment on
          // this site: the route that receives this request cannot carry one.
          const data = await prepare(new FormData(form), "attachment", 1);
          if (!data) return;
          form.reset();
          onSend(data);
        }}
        className="flex items-center gap-2 border-t border-brand-border bg-brand-card p-3"
      >
        <label className="flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-[10px] border border-brand-border text-brand-primary">
          <Icon name="paperclip" className="h-4.5 w-4.5" />
          <input
            type="file"
            name="attachment"
            accept={ATTACHMENT_ACCEPT}
            className="sr-only"
            disabled={sending}
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
          disabled={sending}
          aria-label={sending ? "Enviando mensagem..." : "Enviar mensagem"}
          aria-busy={sending}
          className="flex h-11 w-11 flex-none items-center justify-center rounded-[10px] bg-brand-primary text-white disabled:opacity-70"
        >
          <Icon name="send" className="h-4 w-4" />
        </button>
      </form>
      {(uploadError ?? error) && (
        <p className="bg-brand-card px-3.5 pb-2 text-center text-[11.5px] font-semibold text-red-700">
          {uploadError ?? error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2 border-t border-brand-border bg-brand-card px-3.5 py-2.5 text-center">
        {nudge}
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
  email,
  onSubmit,
  onDismiss,
  pending,
  error,
}: {
  conversation: ConversationView | null;
  email: string;
  onSubmit: (formData: FormData) => void;
  /** "Fechar": leaves without rating. */
  onDismiss: () => void;
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
        <p className="text-[13.5px] font-semibold text-brand-primary">
          {closedByForCitizen(
            conversation?.closedReason ?? null,
            conversation?.attendantName,
          )}
        </p>
        <p className="mt-1 text-[12.5px] text-brand-muted">
          {emailHelpLine(email)}
        </p>
        <p className="mt-3 text-[14px] text-brand-muted">
          Como foi o atendimento? (opcional)
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
      <button
        type="button"
        onClick={onDismiss}
        disabled={pending}
        className="btn btn-ghost btn-md"
      >
        Fechar
      </button>
    </form>
  );
}

/**
 * Asked before the citizen ends or gives up: why. One of a short list,
 * plus their own words if they want; it reaches the office as a line in
 * the conversation. "Voltar" keeps the conversation going.
 */
function GiveUpView({
  email,
  pending,
  error,
  onConfirm,
  onBack,
}: {
  email: string;
  pending: boolean;
  error: string | null;
  onConfirm: (form: FormData) => void;
  onBack: () => void;
}) {
  const [reason, setReason] = useState<string>("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onConfirm(new FormData(event.currentTarget));
      }}
      className="flex flex-1 flex-col gap-3 overflow-y-auto p-4.5"
    >
      <p className="font-serif text-[16px] font-semibold text-brand-primary">
        Por que você está encerrando?
      </p>
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Motivo do encerramento</legend>
        {GIVE_UP_REASONS.map((option) => (
          <label
            key={option}
            className="flex items-center gap-2.5 text-[13.5px] text-brand-text"
          >
            <input
              type="radio"
              name="reason"
              value={option}
              checked={reason === option}
              onChange={() => setReason(option)}
              className="h-4 w-4"
            />
            {option}
          </label>
        ))}
      </fieldset>
      <textarea
        name="detail"
        rows={2}
        maxLength={GIVE_UP_DETAIL_MAX}
        placeholder="Quer contar mais? (opcional)"
        className="w-full rounded-[10px] border border-brand-border bg-brand-surface px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand-accent"
      />
      <p className="text-[12.5px] text-brand-muted">{emailHelpLine(email)}</p>
      {error && (
        <p className="text-center text-[12.5px] font-semibold text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!reason || pending}
        className="btn btn-primary btn-lg"
      >
        {pending ? "Encerrando..." : "Encerrar atendimento"}
      </button>
      <button
        type="button"
        onClick={onBack}
        disabled={pending}
        className="btn btn-ghost btn-md"
      >
        Voltar para a conversa
      </button>
    </form>
  );
}

/**
 * "Chamar atenção", the citizen's side: free after ten minutes without an
 * answer, then every ten minutes. While it waits the button says how long
 * is left; the server is what actually holds the line (see
 * core/chat/nudge.ts), this only shows it.
 */
function NudgeButton({
  availableAt,
  pending,
  error,
  onNudge,
}: {
  availableAt?: string;
  pending: boolean;
  error: string | null;
  onNudge: () => void;
}) {
  const [now, setNow] = useState(() => new Date());
  // Ticks every 15s, and right away when the server hands a new time (just
  // after a call): otherwise "em 10 min" would read "em 11 min" for a beat.
  // biome-ignore lint/correctness/useExhaustiveDependencies: availableAt is the trigger, not a value read inside
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, [availableAt]);
  const at = availableAt ? new Date(availableAt) : null;
  const waiting = at !== null && now < at;
  return (
    <span className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={onNudge}
        disabled={pending || waiting || !at}
        className="btn btn-secondary btn-sm"
        title="Faz a tela do atendimento tremer e tocar"
      >
        {pending
          ? "Chamando..."
          : waiting && at
            ? `Chamar atenção (${nudgeWaitLabel(at, now)})`
            : "Chamar atenção"}
      </button>
      {error && (
        <span className="text-[11.5px] font-semibold text-red-700">
          {error}
        </span>
      )}
    </span>
  );
}
