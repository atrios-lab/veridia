"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ChannelAlert } from "@/core/alerts/office.ts";
import { NUDGE_SOUND } from "@/core/chat/alerts.ts";
import { playSound, unlockAudio } from "../../_components/chat-sound.ts";
import { shakeElement, vibrate } from "../../_components/shake.ts";
import {
  pollInbox,
  pollMessenger,
  type SerializedMessage,
  sendText,
} from "../(dashboard)/mensagens/actions.ts";
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
 * and answer without leaving what is being done there (decision of
 * 11/11/2026). The page behind stays usable: the window is small, in a
 * corner, and not a modal.
 */
function MiniChat({
  caller,
  onClose,
}: {
  caller: Caller;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<SerializedMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const last = useRef<string | null>(null);
  const list = useRef<HTMLDivElement>(null);

  const poll = useCallback(async () => {
    const result = await pollMessenger(caller.conversationId, last.current);
    if (!result.ok) return;
    const fresh = result.data.messages;
    if (!fresh.length) return;
    last.current = fresh.at(-1)?.createdAt ?? last.current;
    setMessages((current) => {
      const known = new Set(current.map((m) => m.id));
      return [...current, ...fresh.filter((m) => !known.has(m.id))].slice(-40);
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

  return (
    <section
      aria-label={`Conversa com ${caller.senderName}`}
      className="pointer-events-auto flex h-[420px] max-h-[70vh] w-[330px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[14px] border border-admin-border bg-admin-card shadow-2xl"
    >
      <header className="flex items-center gap-2 bg-gradient-to-r from-msg-verde-from to-msg-verde-to px-3 py-2 text-white">
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
          {caller.senderName}
        </span>
        <Link
          href={`/admin/mensagens?com=${caller.senderId}`}
          className="rounded-md bg-white/15 px-1.5 py-0.5 text-[11px] font-semibold hover:bg-white/25"
          title="Abrir em Mensagens internas"
        >
          Abrir tudo
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar a conversa flutuante"
          className="rounded-md px-1.5 text-[16px] leading-none hover:bg-white/20"
        >
          ×
        </button>
      </header>
      <div
        ref={list}
        className="min-h-0 flex-1 overflow-y-auto bg-msg-pane px-3 py-2"
      >
        {messages.map((message) => {
          const mine = message.senderId !== caller.senderId;
          return message.kind === "chamar" ? (
            <p
              key={message.id}
              className="my-1.5 text-center text-[11.5px] font-semibold italic text-msg-busy"
            >
              *** {mine ? "Você" : message.senderName} chamou a atenção! ***
            </p>
          ) : (
            <div
              key={message.id}
              className={`my-1.5 rounded-[10px] px-2.5 py-1.5 text-[12.5px] ${mine ? "ml-6 bg-msg-mine" : "mr-6 bg-admin-card"}`}
            >
              <p className="text-[11px] text-admin-muted">
                <strong className="text-admin-primary">
                  {mine ? "Você" : message.senderName}
                </strong>{" "}
                · {time(message.createdAt)}
              </p>
              {message.kind === "texto" ? (
                <p className="whitespace-pre-wrap text-admin-text [overflow-wrap:anywhere]">
                  {message.body}
                </p>
              ) : (
                <a
                  href={`/admin/mensagens/arquivo/${message.id}`}
                  target="_blank"
                  rel="noopener"
                  className="font-semibold text-admin-primary underline [overflow-wrap:anywhere]"
                >
                  {message.kind === "audio"
                    ? "🎤 Ouvir áudio"
                    : `📎 ${message.fileName}`}
                </a>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-end gap-1.5 border-t border-admin-border p-2">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          rows={2}
          maxLength={4000}
          aria-label="Responder"
          placeholder="Responder (Enter envia)"
          className="min-w-0 flex-1 resize-none rounded-[9px] border border-admin-input-border bg-admin-input-bg px-2.5 py-1.5 text-[12.5px] text-admin-text outline-none focus:border-admin-primary-soft"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={busy || !text.trim()}
          className="btn btn-admin-primary btn-sm shrink-0"
        >
          Enviar
        </button>
      </div>
    </section>
  );
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
  const since = useRef(new Date().toISOString());
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

  if (!setting.enabled || onMessenger) return null;
  const showBalloon = setting.popup && unread > 0 && !open;

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2">
      {open && <MiniChat caller={open} onClose={() => setOpen(null)} />}
      {showBalloon && (
        <div className="pointer-events-auto w-[300px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[14px] border-2 border-msg-busy bg-admin-card shadow-xl">
          <span className="flex items-center justify-between bg-gradient-to-r from-msg-verde-from to-msg-verde-to px-3 py-1 text-[11.5px] font-semibold text-white">
            Mensagens internas
            <span className="rounded-full bg-white/25 px-1.5 text-[10.5px]">
              {unread} sem ler
            </span>
          </span>
          <span className="block px-3 pt-2.5 text-[12.5px] text-admin-text">
            {caller ? (
              <>
                <strong className="text-admin-primary">
                  {caller.senderName}
                </strong>{" "}
                {caller.nudge ? (
                  <span className="font-semibold text-msg-busy">
                    chamou a sua atenção!
                  </span>
                ) : (
                  <>
                    diz:
                    <span className="mt-0.5 block truncate text-admin-muted">
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
              <button
                type="button"
                onClick={() => setOpen(caller)}
                className="btn btn-admin-primary btn-sm"
              >
                Responder aqui
              </button>
            ) : (
              <Link
                href="/admin/mensagens"
                className="btn btn-admin-primary btn-sm"
              >
                Abrir mensagens
              </Link>
            )}
          </span>
        </div>
      )}
      {/* The floating balloon itself: always at hand while something waits. */}
      {unread > 0 && (
        <button
          type="button"
          onClick={() => (caller ? setOpen(open ? null : caller) : null)}
          aria-label={`${unread} mensagens internas sem ler`}
          className="pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-msg-verde-from to-msg-verde-to text-[24px] text-white shadow-xl motion-safe:animate-bounce"
        >
          💬
          <span className="absolute -top-1 -right-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-msg-busy px-1 text-[11px] font-bold">
            {unread}
          </span>
        </button>
      )}
    </div>
  );
}
