"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type AlertSnapshot,
  type ChatAlert,
  diffAlerts,
  queueNeedsAttention,
  waitingLabel,
} from "@/core/chat/alerts.ts";
import {
  isAudioLocked,
  playSound,
  unlockAudio,
} from "../../_components/chat-sound.ts";
import { alertSnapshotAction } from "../(dashboard)/atendimento/actions.ts";
import { useAlertPrefs } from "./chat-alert-prefs.ts";
import { AdminIcon } from "./icon.tsx";

/**
 * Every 5s, also with the tab in the background. Unlike the queue screen's
 * own refresh (use-live-version, paused while hidden), this one has to run
 * when the attendant is on another tab: that is the whole point of it.
 * Chrome slows timers in a tab hidden for several minutes to about once a
 * minute; that is the browser's floor, not ours.
 */
const POLL_MS = 5000;
const QUEUE_HREF = "/admin/atendimento";
const TITLE_BLINK_MS = 1000;

/** The element the dashboard layout gives this id is what shakes. */
export const CHAT_SHAKE_TARGET_ID = "painel";
// Written out whole so Tailwind sees the class in source.
const SHAKE_CLASS = "motion-safe:animate-chat-shake";
// Three flashes of 0.5s (see chat-flash in globals.css), then gone.
const BURST_MS = 1600;

/**
 * The attendant's alerts, mounted once by the dashboard layout for whoever
 * attends the chat, so they work from any panel screen: a tone at the
 * chosen volume, the browser's own notification, the tab title blinking
 * while the panel is in the background, and a reminder card that pulses on
 * screen until someone looks. What changed between two polls is decided in
 * core/chat/alerts.ts; this only plays it.
 */
export function ChatAlerts() {
  const prefs = useAlertPrefs();
  const pathname = usePathname();
  const router = useRouter();
  const previous = useRef<AlertSnapshot | undefined>(undefined);
  const [snapshot, setSnapshot] = useState<AlertSnapshot | null>(null);
  const [pending, setPending] = useState<ChatAlert[]>([]);
  const [queueDismissed, setQueueDismissed] = useState(false);
  const [locked, setLocked] = useState(false);
  const [burst, setBurst] = useState<ChatAlert | null>(null);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const ring = useCallback(() => {
    const { sound, volume } = prefsRef.current;
    if (sound === "none" || volume === 0) return;
    if (!playSound(sound, volume)) setLocked(isAudioLocked());
  }, []);

  /**
   * "Chamar atenção": the panel shakes once and "Chat" flashes over the
   * screen. Only for news, never for the repeat ring: a screen that shakes
   * every ten seconds is a screen nobody can work on.
   */
  const callAttention = useCallback((alert: ChatAlert) => {
    if (!prefsRef.current.shake) return;
    setBurst(alert);
    window.setTimeout(() => setBurst(null), BURST_MS);
    const target = document.getElementById(CHAT_SHAKE_TARGET_ID);
    if (!target) return;
    target.classList.remove(SHAKE_CLASS);
    // Reading layout restarts the animation when two alerts land close.
    void target.offsetWidth;
    target.classList.add(SHAKE_CLASS);
    target.addEventListener(
      "animationend",
      () => target.classList.remove(SHAKE_CLASS),
      { once: true },
    );
  }, []);

  // The browser holds sound back until a first click or key on the page.
  // Any one unlocks it, so the attendant never has to hunt for a button.
  useEffect(() => {
    setLocked(isAudioLocked());
    const unlock = () => {
      void unlockAudio().then((ok) => setLocked(!ok));
    };
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, []);

  const handle = useCallback(
    (next: AlertSnapshot) => {
      // A message in the conversation already open in front of the
      // attendant is not news: the screen itself shows it.
      const watching = (alert: ChatAlert) =>
        alert.kind !== "new-waiting" &&
        alert.href === pathRef.current &&
        document.visibilityState === "visible";
      const alerts = diffAlerts(previous.current, next).filter(
        (alert) => !watching(alert),
      );
      previous.current = next;
      setSnapshot(next);

      // Reminders for conversations that are no longer mine go away.
      const mine = new Set(next.mine.map((c) => c.id));
      setPending((current) =>
        current.filter((alert) => mine.has(alert.conversationId)),
      );
      if (alerts.length === 0) return;

      ring();
      callAttention(alerts[0]);
      if (alerts.some((alert) => alert.kind === "new-waiting")) {
        setQueueDismissed(false);
      }
      setPending((current) => {
        const kept = current.filter(
          (old) =>
            !alerts.some(
              (alert) => alert.conversationId === old.conversationId,
            ),
        );
        return [
          ...kept,
          ...alerts.filter((alert) => alert.kind !== "new-waiting"),
        ];
      });

      if (
        prefsRef.current.notify &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        for (const alert of alerts) {
          try {
            const notification = new Notification(alert.title, {
              body: alert.body,
              tag: `${alert.kind}:${alert.conversationId}`,
            });
            notification.onclick = () => {
              window.focus();
              router.push(alert.href);
              notification.close();
            };
          } catch {
            // Some browsers only allow notifications from a service worker;
            // the sound, the title and the card still carry the alert.
          }
        }
      }
    },
    [ring, callAttention, router],
  );

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      try {
        const next = await alertSnapshotAction();
        if (!stopped && next) handle(next);
      } catch {
        // A missed poll is a late ring; the next one catches up.
      }
    };
    void poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [handle]);

  // Opening the conversation, or the queue, is the attendant answering.
  useEffect(() => {
    setPending((current) => current.filter((alert) => alert.href !== pathname));
    if (pathname === QUEUE_HREF) setQueueDismissed(true);
  }, [pathname]);

  const queueWaiting = snapshot ? queueNeedsAttention(snapshot) : false;

  // "Repetir até atender": rings again while someone is still waiting.
  useEffect(() => {
    if (!prefs.repeat || !queueWaiting) return;
    const timer = setInterval(ring, prefs.repeatSeconds * 1000);
    return () => clearInterval(timer);
  }, [prefs.repeat, prefs.repeatSeconds, queueWaiting, ring]);

  // The tab title blinks while the panel is in the background and something
  // is waiting, and goes back the moment the attendant returns.
  const attention = queueWaiting || pending.length > 0;
  useEffect(() => {
    if (!attention) return;
    const original = document.title;
    const count = (snapshot?.waiting.length ?? 0) + pending.length;
    const alertTitle = `(${count}) Atendimento aguardando`;
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
      document.title = on ? alertTitle : original;
    }, TITLE_BLINK_MS);
    return () => {
      clearInterval(timer);
      document.title = original;
    };
  }, [attention, snapshot?.waiting.length, pending.length]);

  const showQueue =
    queueWaiting && !queueDismissed && pathname !== QUEUE_HREF && snapshot;
  const showLocked =
    locked && prefs.sound !== "none" && prefs.volume > 0 && attention;
  const flash = burst && (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-admin-primary/85 opacity-0 motion-safe:animate-chat-flash"
    >
      <div className="px-6 text-center text-white">
        <p className="font-serif text-5xl font-semibold md:text-7xl">Chat</p>
        <p className="mt-3 text-lg font-bold md:text-2xl">{burst.title}</p>
        <p className="mt-1 text-base opacity-90 md:text-xl">{burst.body}</p>
      </div>
    </div>
  );

  const cards =
    (prefs.flash && (showQueue || pending.length > 0)) || showLocked;
  if (!cards) return flash || null;

  return (
    <>
      {flash}
      <section
        aria-label="Avisos do atendimento"
        className="fixed right-4 bottom-4 z-40 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2.5"
      >
        {showLocked && (
          <button
            type="button"
            onClick={() => void unlockAudio().then((ok) => setLocked(!ok))}
            className="flex items-center gap-2 rounded-xl bg-admin-warning-bg px-3.5 py-2.5 text-left text-[12.5px] font-semibold text-admin-warning-text shadow-lg"
          >
            <AdminIcon name="alert" className="h-4 w-4 flex-none" />O navegador
            bloqueou o som. Clique aqui para ativar.
          </button>
        )}
        {prefs.flash && showQueue && (
          <AlertCard
            title={waitingLabel(snapshot.waiting.length)}
            body={snapshot.waiting
              .slice(0, 2)
              .map((c) => c.citizenName)
              .join(", ")}
            href={QUEUE_HREF}
            action="Ver fila"
            onDismiss={() => setQueueDismissed(true)}
          />
        )}
        {prefs.flash &&
          pending.map((alert) => (
            <AlertCard
              key={`${alert.kind}:${alert.conversationId}`}
              title={alert.title}
              body={alert.body}
              href={alert.href}
              action="Abrir"
              onDismiss={() =>
                setPending((current) =>
                  current.filter(
                    (old) => old.conversationId !== alert.conversationId,
                  ),
                )
              }
            />
          ))}
      </section>
    </>
  );
}

/**
 * The on-screen reminder: the panel's solid "look here" fill with the
 * pulsing halo the Treinamento item uses (attention-pulse), so it is seen
 * from across the counter, and still behind `motion-safe:` like every
 * pulse in the panel.
 */
function AlertCard({
  title,
  body,
  href,
  action,
  onDismiss,
}: {
  title: string;
  body: string;
  href: string;
  action: string;
  onDismiss: () => void;
}) {
  return (
    <output className="flex items-start gap-3 rounded-xl bg-admin-primary px-4 py-3 text-white shadow-xl motion-safe:animate-attention-pulse">
      <AdminIcon name="chat" className="mt-0.5 h-4.5 w-4.5 flex-none" />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-bold">{title}</p>
        {body && <p className="truncate text-[12.5px] opacity-85">{body}</p>}
        <Link
          href={href}
          className="mt-1.5 inline-block text-[12.5px] font-bold underline"
        >
          {action}
        </Link>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="flex-none rounded-md p-1 opacity-80 hover:opacity-100"
        aria-label={`Dispensar: ${title}`}
      >
        <AdminIcon name="x" className="h-4 w-4" />
      </button>
    </output>
  );
}
