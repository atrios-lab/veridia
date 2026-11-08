"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { addMinutes } from "@/core/scheduling/agenda.ts";
import { formatShortDate } from "@/core/scheduling/calendar.ts";
import { ARRIVING_SOON_MINUTES } from "@/core/scheduling/reminders.ts";
import type {
  AgendaAlertItem,
  AgendaAlertSnapshot,
} from "@/lib/appointment-reminders.ts";
import { playSound } from "../../_components/chat-sound.ts";
import { agendaAlertSnapshotAction } from "../(dashboard)/agenda/actions.ts";
import { readAlertPrefs } from "./chat-alert-prefs.ts";
import { AdminIcon } from "./icon.tsx";

/** Once a minute, with the tab in the background too: a citizen arriving in
 * fifteen minutes is worth knowing about whatever screen is open. */
const POLL_MS = 60_000;
const STORAGE_KEY = "agenda-alerts";

interface Seen {
  /** Bookings made before this instant are not news. */
  since: string;
  /** Cards closed by hand: "new:<id>", "soon:<id>", "day:<date>". */
  dismissed: string[];
}

function readSeen(): Seen | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Seen) : null;
  } catch {
    return null;
  }
}

function writeSeen(seen: Seen): void {
  try {
    // Only the last ones matter: the list must not grow for ever.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...seen, dismissed: seen.dismissed.slice(-200) }),
    );
  } catch {
    // A browser that refuses storage shows the cards again on reload,
    // which is a nuisance, not a failure.
  }
}

function agendaHref(item: Pick<AgendaAlertItem, "agenda" | "date">): string {
  return `/admin/agenda?agenda=${item.agenda}&dia=${item.date}`;
}

/**
 * The agenda's reminders in the panel, on every screen, for whoever manages
 * the agenda: today's appointments when the day starts, each booking the
 * site takes (with a tone and the browser's notification), and the citizen
 * about to arrive, fifteen minutes ahead. Each card closes by hand and stays
 * closed on this computer.
 */
export function AgendaAlerts() {
  const [snapshot, setSnapshot] = useState<AgendaAlertSnapshot | null>(null);
  const [seen, setSeen] = useState<Seen | null>(null);
  const announced = useRef(new Set<string>());

  const dismiss = useCallback((key: string) => {
    setSeen((current) => {
      const next = {
        since: current?.since ?? new Date().toISOString(),
        dismissed: [...(current?.dismissed ?? []), key],
      };
      writeSeen(next);
      return next;
    });
  }, []);

  useEffect(() => {
    // The first visit ever starts from now: last week's bookings are not
    // news to someone opening the panel for the first time.
    const stored = readSeen() ?? {
      since: new Date().toISOString(),
      dismissed: [],
    };
    writeSeen(stored);
    setSeen(stored);

    let stopped = false;
    const poll = async () => {
      try {
        const next = await agendaAlertSnapshotAction();
        if (!stopped && next) setSnapshot(next);
      } catch {
        // A missed poll is a late card; the next one catches up.
      }
    };
    void poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  const fresh =
    snapshot && seen
      ? snapshot.recent.filter(
          (item) =>
            item.createdAt > seen.since &&
            !seen.dismissed.includes(`new:${item.id}`),
        )
      : [];

  // A tone and the browser's notification, once per booking.
  useEffect(() => {
    const news = fresh.filter((item) => !announced.current.has(item.id));
    if (news.length === 0) return;
    for (const item of news) announced.current.add(item.id);
    const prefs = readAlertPrefs();
    if (prefs.sound !== "none" && prefs.volume > 0) {
      playSound(prefs.sound, prefs.volume);
    }
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      for (const item of news) {
        try {
          new Notification("Novo agendamento pelo site", {
            body: `${item.citizenName} · ${formatShortDate(item.date)} às ${item.slotTime}`,
            tag: `agenda:${item.id}`,
          });
        } catch {
          // Some browsers only notify from a service worker; the card stays.
        }
      }
    }
  }, [fresh]);

  if (!snapshot || !seen) return null;
  const { now } = snapshot;
  const soonLimit = addMinutes(now.time, ARRIVING_SOON_MINUTES);
  const soon = snapshot.today.filter(
    (item) =>
      item.slotTime >= now.time &&
      item.slotTime <= soonLimit &&
      !seen.dismissed.includes(`soon:${item.id}`),
  );
  const ahead = snapshot.today.filter((item) => item.slotTime >= now.time);
  const dayKey = `day:${now.date}`;
  const showDay = ahead.length > 0 && !seen.dismissed.includes(dayKey);

  if (fresh.length === 0 && soon.length === 0 && !showDay) return null;

  return (
    <section
      aria-label="Avisos da agenda"
      className="fixed bottom-4 left-4 z-40 flex w-[min(340px,calc(100vw-2rem))] flex-col gap-2.5 md:left-[252px]"
    >
      {soon.map((item) => (
        <Card
          key={`soon-${item.id}`}
          tone="strong"
          title={`Às ${item.slotTime}: ${item.citizenName}`}
          body={`${item.serviceLabel} · ${item.agendaName} · chega em até ${ARRIVING_SOON_MINUTES} minutos`}
          href={agendaHref(item)}
          action="Abrir a agenda"
          onDismiss={() => dismiss(`soon:${item.id}`)}
        />
      ))}
      {fresh.map((item) => (
        <Card
          key={`new-${item.id}`}
          tone="strong"
          title="Novo agendamento pelo site"
          body={`${item.citizenName} · ${formatShortDate(item.date)} às ${item.slotTime} · ${item.agendaName}`}
          href={agendaHref(item)}
          action="Ver na agenda"
          onDismiss={() => dismiss(`new:${item.id}`)}
        />
      ))}
      {showDay && (
        <Card
          tone="soft"
          title={`Hoje: ${ahead.length} ${ahead.length === 1 ? "agendamento" : "agendamentos"}`}
          body={ahead
            .slice(0, 3)
            .map((item) => `${item.slotTime} ${item.citizenName}`)
            .join(" · ")}
          href={agendaHref({ agenda: ahead[0].agenda, date: now.date })}
          action="Ver o dia"
          onDismiss={() => dismiss(dayKey)}
        />
      )}
    </section>
  );
}

function Card({
  tone,
  title,
  body,
  href,
  action,
  onDismiss,
}: {
  tone: "strong" | "soft";
  title: string;
  body: string;
  href: string;
  action: string;
  onDismiss: () => void;
}) {
  return (
    <output
      className={`flex items-start gap-3 rounded-xl px-4 py-3 shadow-xl ${
        tone === "strong"
          ? "bg-admin-primary text-white motion-safe:animate-attention-pulse"
          : "border border-admin-border bg-admin-card text-admin-text"
      }`}
    >
      <AdminIcon name="calendar" className="mt-0.5 h-4.5 w-4.5 flex-none" />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-bold">{title}</p>
        {body && <p className="text-[12.5px] opacity-85">{body}</p>}
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
