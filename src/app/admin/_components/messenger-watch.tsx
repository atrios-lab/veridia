"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ChannelAlert } from "@/core/alerts/office.ts";
import { NUDGE_SOUND } from "@/core/chat/alerts.ts";
import { LONG_TEXT_MAX } from "@/core/text-limits.ts";
import { playSound, unlockAudio } from "../../_components/chat-sound.ts";
import { shakeElement, vibrate } from "../../_components/shake.ts";
import { Button, buttonVariants } from "../_ui/button.tsx";
import { cn } from "../_ui/cn.ts";
import { Textarea } from "../_ui/textarea.tsx";
import {
  pollInbox,
  pollMessenger,
  type SerializedMessage,
  sendFile,
  sendText,
} from "../(dashboard)/mensagens/actions.ts";
import { MicHelp, useRecorder } from "../(dashboard)/mensagens/recorder.tsx";
import { CHAT_SHAKE_TARGET_ID } from "./chat-alerts.tsx";

const POLL_MS = 4000;
const MINI_POLL_MS = 3000;
/** While something waits unread, the tone comes back this often. */
const INSIST_MS = 10_000;
const VOLUME = 80;

interface Caller {
  conversationId: string;
  senderId: string;
  senderName: string;
  preview: string;
  nudge: boolean;
}

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

/**
 * The conversation in a small floating window, over any screen, to read
 * and answer without leaving what is being done there (decisions of
 * 11/11/2026): text, files and voice notes; it minimizes to a bar and
 * moves wherever the person drags it by its title. The page behind stays
 * usable: the window is small and not a modal.
 */
function MiniChat({
  caller,
  onClose,
  onMinimize,
  onDragStart,
}: {
  caller: Caller;
  onClose: () => void;
  onMinimize: () => void;
  onDragStart: (event: React.PointerEvent) => void;
}) {
  const [messages, setMessages] = useState<SerializedMessage[]>([]);
  const [cleared, setCleared] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const last = useRef<string | null>(null);
  const list = useRef<HTMLDivElement>(null);

  const poll = useCallback(async () => {
    const result = await pollMessenger(caller.conversationId, last.current);
    if (!result.ok) return;
    const fresh = result.data.messages;
    // The server's clock: edits and deletions since then come next time.
    last.current = result.data.now;
    setCleared(result.data.clearedAt);
    if (!fresh.length) return;
    setMessages((current) => {
      const changed = new Map(fresh.map((m) => [m.id, m]));
      const have = new Set(current.map((m) => m.id));
      return [
        ...current.map((m) => changed.get(m.id) ?? m),
        ...fresh.filter((m) => !have.has(m.id)),
      ].slice(-40);
    });
  }, [caller.conversationId]);

  useEffect(() => {
    last.current = null;
    setMessages([]);
    void poll();
    const timer = setInterval(() => void poll(), MINI_POLL_MS);
    return () => clearInterval(timer);
  }, [poll]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scrolls when messages arrive
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages.length]);

  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    const result = await sendText(caller.conversationId, text);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setText("");
    void poll();
  };

  const upload = async (file: File, audio = false) => {
    const data = new FormData();
    data.set("conversationId", caller.conversationId);
    data.set("file", file);
    if (audio) data.set("audio", "1");
    setBusy(true);
    const result = await sendFile(data);
    setBusy(false);
    if (!result.ok) toast.error(result.message);
    else void poll();
  };
  const recorder = useRecorder((file) => void upload(file, true));

  return (
    <section
      aria-label={`Conversa com ${caller.senderName}`}
      className="pointer-events-auto flex h-110 max-h-[75vh] w-85 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-lg"
    >
      <header
        onPointerDown={onDragStart}
        title="Arraste para mudar de lugar"
        className="flex cursor-move touch-none select-none items-center gap-1.5 bg-gradient-to-r from-msg-verde-from to-msg-verde-to px-3 py-2 text-white"
      >
        <span aria-hidden="true" className="text-xs opacity-70">
          ⠿
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {caller.senderName}
        </span>
        <Link
          href={`/admin/mensagens?com=${caller.senderId}`}
          onPointerDown={(event) => event.stopPropagation()}
          className="rounded-md bg-white/15 px-1.5 py-0.5 text-xs font-medium hover:bg-white/25"
          title="Abrir em Mensagens internas"
        >
          Abrir tudo
        </Link>
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onMinimize}
          aria-label="Minimizar a conversa"
          title="Minimizar (reabre quando chegar mensagem)"
          className="flex size-6 cursor-pointer items-center justify-center rounded-md hover:bg-white/20"
        >
          <span
            aria-hidden="true"
            className="block h-0.5 w-3 rounded-sm bg-white"
          />
        </button>
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onClose}
          aria-label="Fechar a conversa flutuante"
          className="cursor-pointer rounded-md px-1.5 text-base leading-none hover:bg-white/20"
        >
          ×
        </button>
      </header>
      <div
        ref={list}
        className="min-h-0 flex-1 overflow-y-auto bg-msg-pane px-3 py-2"
      >
        {messages
          .filter(
            (m) =>
              !m.deleted &&
              (!cleared || new Date(m.createdAt) > new Date(cleared)),
          )
          .map((message) => {
            const mine = message.senderId !== caller.senderId;
            const href = `/admin/mensagens/arquivo/${message.id}`;
            return message.kind === "chamar" ? (
              <p
                key={message.id}
                className="my-1.5 text-center text-xs font-medium text-msg-busy italic"
              >
                *** {mine ? "Você" : message.senderName} chamou a atenção! ***
              </p>
            ) : (
              <div
                key={message.id}
                className={cn(
                  "my-1.5 rounded-lg px-2.5 py-1.5 text-sm",
                  mine ? "ml-6 bg-msg-mine" : "mr-6 bg-card",
                )}
              >
                <p className="text-xs text-muted-foreground">
                  <strong className="font-semibold text-foreground">
                    {mine ? "Você" : message.senderName}
                  </strong>{" "}
                  · {time(message.createdAt)}
                </p>
                {message.kind === "texto" ? (
                  <p className="whitespace-pre-wrap text-foreground [overflow-wrap:anywhere]">
                    {message.body}
                  </p>
                ) : message.kind === "audio" ? (
                  // biome-ignore lint/a11y/useMediaCaption: a voice note between colleagues has no caption track
                  <audio
                    controls
                    preload="none"
                    src={href}
                    className="mt-1 h-9 w-full"
                  />
                ) : (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener"
                    className="font-medium text-primary underline [overflow-wrap:anywhere]"
                  >
                    📎 {message.fileName}
                  </a>
                )}
              </div>
            );
          })}
      </div>
      <div className="border-t p-2">
        <div className="mb-1.5 flex items-center gap-1">
          <label
            className={cn(
              buttonVariants({ variant: "ghost", size: "xs" }),
              "cursor-pointer text-primary has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
            )}
            title="Enviar arquivo ou PDF (até 4 MB)"
          >
            📎 Arquivo
            <input
              type="file"
              className="sr-only"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
                event.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              recorder.recording ? recorder.stop() : void recorder.start()
            }
            className={cn(
              buttonVariants({ variant: "ghost", size: "xs" }),
              recorder.recording
                ? "animate-pulse bg-msg-busy text-white hover:bg-msg-busy hover:text-white"
                : "text-primary",
            )}
          >
            {recorder.recording ? "⏹ Parar e enviar" : "🎤 Áudio"}
          </button>
          {busy && (
            <span className="text-xs text-muted-foreground">Enviando...</span>
          )}
        </div>
        {recorder.mic === "denied" && (
          <MicHelp onRetry={() => void recorder.allow()} />
        )}
        <div className="flex items-end gap-1.5">
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            rows={2}
            maxLength={LONG_TEXT_MAX}
            aria-label="Responder"
            placeholder="Responder (Enter envia)"
            className="field-sizing-fixed min-h-0 min-w-0 flex-1 resize-none px-2.5 py-1.5"
          />
          <Button
            type="button"
            size="sm"
            onClick={() => void send()}
            disabled={busy || !text.trim()}
            className="shrink-0"
          >
            Enviar
          </Button>
        </div>
      </div>
    </section>
  );
}

const POSITION_KEY = "veridia.mensagens.posicao";

/** Where the floating window sits: distance from the right and the bottom. */
function useFloatingPosition() {
  const [pos, setPos] = useState({ right: 16, bottom: 16 });
  // A drag ends in a click too: this tells the click it was a drag.
  const dragged = useRef(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        window.localStorage.getItem(POSITION_KEY) ?? "null",
      ) as { right: number; bottom: number } | null;
      if (saved) setPos(saved);
    } catch {
      // Nothing saved, or a private window: the corner it is.
    }
  }, []);
  const startDrag = (event: React.PointerEvent) => {
    event.preventDefault();
    const origin = { x: event.clientX, y: event.clientY, ...pos };
    let latest = pos;
    dragged.current = false;
    const move = (e: PointerEvent) => {
      if (Math.abs(e.clientX - origin.x) + Math.abs(e.clientY - origin.y) > 4) {
        dragged.current = true;
      }
      latest = {
        right: Math.min(
          Math.max(0, origin.right - (e.clientX - origin.x)),
          window.innerWidth - 120,
        ),
        bottom: Math.min(
          Math.max(0, origin.bottom - (e.clientY - origin.y)),
          window.innerHeight - 60,
        ),
      };
      setPos(latest);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      try {
        window.localStorage.setItem(POSITION_KEY, JSON.stringify(latest));
      } catch {
        // Not remembered; it still moved.
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return { pos, startDrag, wasDragged: () => dragged.current };
}

/**
 * The internal messenger on every panel screen (decisions of 11/11/2026):
 * a floating balloon when a colleague writes, which opens the conversation
 * in a small window over the current screen; while anything waits unread
 * the tone comes back every ten seconds and the tab's title blinks; a call
 * for attention shakes the panel. Bounded by the office's choice for the
 * channel (Configurações › Notificações › Mensagens internas) and by each
 * person's own "som".
 */
export function MessengerWatch({
  setting,
  sound,
  initialUnread,
}: {
  setting: ChannelAlert;
  sound: boolean;
  initialUnread: number;
}) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(initialUnread);
  const [caller, setCaller] = useState<Caller | null>(null);
  const [open, setOpen] = useState<Caller | null>(null);
  const [minimized, setMinimized] = useState(false);
  const { pos, startDrag, wasDragged } = useFloatingPosition();
  const since = useRef(new Date().toISOString());
  // Who was online at the last look: someone new "acabou de entrar".
  const known = useRef<Set<string> | null>(null);
  const lastAnnounced = useRef(new Map<string, number>());
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  // Read inside the poll, which outlives renders.
  const state = useRef({ open, minimized });
  state.current = { open, minimized };
  const tone = setting.enabled && sound ? setting.sound : "none";
  const onMessenger = pathname.startsWith("/admin/mensagens");

  useEffect(() => {
    const unlock = () => void unlockAudio();
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    if (!setting.enabled) return;
    const tick = async () => {
      const result = await pollInbox(since.current).catch(() => null);
      if (!result?.ok) return;
      since.current = result.data.now;
      setUnread(result.data.unread);
      // Signed in just now, like the old desktop messengers (decision of
      // 11/11/2026). The first look only learns who is there; someone who
      // blinks offline and back within 10 minutes is not announced again.
      const online = result.data.online ?? [];
      const seen = known.current;
      known.current = new Set(online.map((p) => p.userId));
      if (seen) {
        const at = Date.now();
        const fresh = online.filter(
          (p) =>
            !seen.has(p.userId) &&
            at - (lastAnnounced.current.get(p.userId) ?? 0) > 10 * 60_000,
        );
        for (const person of fresh)
          lastAnnounced.current.set(person.userId, at);
        if (fresh.length) {
          setArrivals((current) =>
            [
              ...current,
              ...fresh.map((p) => ({ ...p, key: `${p.userId}-${at}` })),
            ].slice(-4),
          );
          if (tone !== "none") playSound(tone, VOLUME / 2);
        }
      }
      const latest = result.data.latest;
      setCaller(
        latest
          ? {
              conversationId: latest.conversationId,
              senderId: latest.senderId,
              senderName: latest.senderName,
              preview: latest.preview,
              nudge: latest.kind === "chamar",
            }
          : null,
      );
      const last = result.data.incoming.at(-1);
      if (!last) return;
      // Minimized, the conversation opens again when a message arrives.
      if (state.current.open && state.current.minimized && latest) {
        setOpen({
          conversationId: latest.conversationId,
          senderId: latest.senderId,
          senderName: latest.senderName,
          preview: latest.preview,
          nudge: latest.kind === "chamar",
        });
        setMinimized(false);
      }
      const nudge = result.data.incoming.some((i) => i.kind === "chamar");
      if (nudge && setting.shake) {
        shakeElement(document.getElementById(CHAT_SHAKE_TARGET_ID));
        vibrate();
      }
      if (tone !== "none") playSound(nudge ? NUDGE_SOUND : tone, VOLUME);
      if (
        setting.notify &&
        document.hidden &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        new Notification("Mensagens internas", {
          body: `${last.senderName} ${last.kind === "chamar" ? "chamou a sua atenção!" : `diz: ${last.preview}`}`,
          tag: "mensagens-internas",
        });
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), POLL_MS);
    return () => clearInterval(timer);
  }, [setting, tone]);

  // Insists: the tone again while anything waits unread.
  useEffect(() => {
    if (unread === 0 || tone === "none") return;
    const timer = setInterval(() => playSound(tone, VOLUME), INSIST_MS);
    return () => clearInterval(timer);
  }, [unread, tone]);

  // The tab's title blinks while anything waits, so it calls from another tab.
  useEffect(() => {
    if (unread === 0 || !setting.enabled) return;
    const original = document.title;
    let on = false;
    const timer = setInterval(() => {
      on = !on;
      document.title = on ? `(${unread}) Nova mensagem interna` : original;
    }, 1000);
    return () => {
      clearInterval(timer);
      document.title = original;
    };
  }, [unread, setting.enabled]);

  const notices = (
    <ArrivalNotices
      arrivals={arrivals}
      onClose={(key) =>
        setArrivals((current) => current.filter((a) => a.key !== key))
      }
    />
  );
  if (!setting.enabled) return null;
  if (onMessenger) return notices;
  const showBalloon = setting.popup && unread > 0 && !open;
  // With the conversation open or minimized, the bar already stands in.
  const showBubble = unread > 0 && !open;

  return (
    <>
      {notices}
      <div
        className="pointer-events-none fixed z-50 flex flex-col items-end gap-2"
        style={{ right: pos.right, bottom: pos.bottom }}
      >
        {open && !minimized && (
          <MiniChat
            caller={open}
            onClose={() => setOpen(null)}
            onMinimize={() => setMinimized(true)}
            onDragStart={startDrag}
          />
        )}
        {open && minimized && (
          <button
            type="button"
            onPointerDown={startDrag}
            onClick={() => {
              if (!wasDragged()) setMinimized(false);
            }}
            title="Abrir a conversa (arraste para mudar de lugar)"
            className="pointer-events-auto flex max-w-65 cursor-pointer items-center gap-2 rounded-full bg-gradient-to-r from-msg-verde-from to-msg-verde-to px-3.5 py-2 text-sm font-medium text-white shadow-lg"
          >
            💬 <span className="truncate">{open.senderName}</span>
            <span className="text-xs opacity-80">(minimizado)</span>
          </button>
        )}
        {showBalloon && (
          <div className="pointer-events-auto w-75 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border-2 border-msg-busy bg-card text-card-foreground shadow-lg">
            <span className="flex items-center justify-between bg-gradient-to-r from-msg-verde-from to-msg-verde-to px-3 py-1 text-xs font-medium text-white">
              Mensagens internas
              <span className="rounded-full bg-white/25 px-1.5 text-xs">
                {unread} sem ler
              </span>
            </span>
            <span className="block px-3 pt-2.5 text-sm text-foreground">
              {caller ? (
                <>
                  <strong className="font-semibold text-foreground">
                    {caller.senderName}
                  </strong>{" "}
                  {caller.nudge ? (
                    <span className="font-medium text-msg-busy">
                      chamou a sua atenção!
                    </span>
                  ) : (
                    <>
                      diz:
                      <span className="mt-0.5 block truncate text-muted-foreground">
                        {caller.preview}
                      </span>
                    </>
                  )}
                </>
              ) : (
                "Você tem mensagens de colegas esperando resposta."
              )}
            </span>
            <span className="flex justify-end gap-2 px-3 pt-2 pb-2.5">
              {caller ? (
                <Button type="button" size="sm" onClick={() => setOpen(caller)}>
                  Responder aqui
                </Button>
              ) : (
                <Link
                  href="/admin/mensagens"
                  className={buttonVariants({ size: "sm" })}
                >
                  Abrir mensagens
                </Link>
              )}
            </span>
          </div>
        )}
        {/* The floating balloon itself: always at hand while something waits. */}
        {showBubble && (
          <button
            type="button"
            onClick={() => (caller ? setOpen(caller) : null)}
            aria-label={`${unread} mensagens internas sem ler`}
            className="pointer-events-auto relative flex size-14 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-msg-verde-from to-msg-verde-to text-2xl text-white shadow-lg motion-safe:animate-bounce"
          >
            💬
            <span className="absolute -top-1 -right-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-msg-busy px-1 text-xs font-semibold">
              {unread}
            </span>
          </button>
        )}
      </div>
    </>
  );
}

interface Arrival {
  key: string;
  userId: string;
  name: string;
  photo: boolean;
}

/** How long an "acabou de entrar" notice stays, unless closed first. */
const ARRIVAL_MS = 10_000;

/**
 * "Fulano acabou de entrar e está online", in the corner, the way the old
 * desktop messengers did it: it goes by itself after 10 seconds, or with
 * the X. A click opens the conversation.
 */
function ArrivalNotices({
  arrivals,
  onClose,
}: {
  arrivals: Arrival[];
  onClose: (key: string) => void;
}) {
  if (!arrivals.length) return null;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-24 left-4 z-50 flex flex-col gap-2 max-md:bottom-20"
    >
      {arrivals.map((arrival) => (
        <ArrivalNotice
          key={arrival.key}
          arrival={arrival}
          onClose={() => onClose(arrival.key)}
        />
      ))}
    </div>
  );
}

function ArrivalNotice({
  arrival,
  onClose,
}: {
  arrival: Arrival;
  onClose: () => void;
}) {
  // The parent re-renders on every poll: the timer must not restart then.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const timer = setTimeout(() => close.current(), ARRIVAL_MS);
    return () => clearTimeout(timer);
  }, []);
  const initials = arrival.name
    .split(/\s+/)
    .filter(Boolean)
    .map((part, index, all) =>
      index === 0 || index === all.length - 1 ? part[0] : "",
    )
    .join("")
    .toUpperCase();
  return (
    <div className="pointer-events-auto w-70 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border bg-card text-card-foreground shadow-lg motion-safe:animate-notice-rise">
      <div className="flex items-center justify-between bg-gradient-to-r from-msg-verde-from to-msg-verde-to px-3 py-1 text-xs font-medium text-white">
        Mensagens internas
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar aviso"
          className="cursor-pointer rounded-sm px-1 text-base leading-none hover:bg-white/20"
        >
          ×
        </button>
      </div>
      <Link
        href={`/admin/mensagens?com=${arrival.userId}`}
        onClick={onClose}
        className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted"
      >
        <span className="relative flex size-10 flex-none items-center justify-center overflow-hidden rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
          {/* The initials stay under the photo while it loads. */}
          {initials}
          {arrival.photo && (
            // biome-ignore lint/performance/noImgElement: a private route, not an optimizable asset
            <img
              src={`/admin/mensagens/foto/${arrival.userId}`}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <span className="absolute right-0.5 bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-msg-online" />
        </span>
        <span className="min-w-0 text-sm leading-snug text-foreground">
          <strong className="block truncate font-semibold">
            {arrival.name}
          </strong>
          acabou de entrar e está online.
        </span>
      </Link>
    </div>
  );
}
