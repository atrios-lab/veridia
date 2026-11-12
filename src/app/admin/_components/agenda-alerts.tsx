"use client";

import Link from "next/link";
import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import type { ChannelAlert } from "@/core/alerts/office.ts";
import { addMinutes } from "@/core/scheduling/agenda.ts";
import { formatShortDate } from "@/core/scheduling/calendar.ts";
import { ARRIVING_SOON_MINUTES } from "@/core/scheduling/reminders.ts";
import type {
  AgendaAlertItem,
  AgendaAlertSnapshot,
} from "@/lib/appointment-reminders.ts";
import { Button } from "../_ui/button.tsx";
import { cn } from "../_ui/cn.ts";
import {
  type ActionState,
  agendaAlertSnapshotAction,
  attendAppointment,
  markAppointmentNoShow,
} from "../(dashboard)/agenda/actions.ts";
import { AdminIcon } from "./icon.tsx";
import { announce } from "./office-alert.ts";

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
export function AgendaAlerts({ setting }: { setting: ChannelAlert }) {
  const [snapshot, setSnapshot] = useState<AgendaAlertSnapshot | null>(null);
  const [seen, setSeen] = useState<Seen | null>(null);
  const announced = useRef(new Set<string>());
  // "Depois" hides a confirmation until the next page load, not for good:
  // the office still has to say whether the citizen came.
  const [later, setLater] = useState<Set<string>>(new Set());
  const pollRef = useRef<() => Promise<void>>(async () => {});

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
    pollRef.current = poll;
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
    // As the office chose for the agenda (Configurações › Notificações).
    announce(
      setting,
      news.map((item) => ({
        title: "Novo agendamento pelo site",
        body: `${item.citizenName} · ${formatShortDate(item.date)} às ${item.slotTime}`,
        tag: `agenda:${item.id}`,
      })),
    );
  }, [fresh, setting]);

  // Silenced, or without the card on screen: no cards at all.
  if (!snapshot || !seen || !setting.enabled || !setting.popup) return null;
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

  const pending = snapshot.pending.filter((item) => !later.has(item.id));
  const shownPending = pending.slice(0, 2);

  if (
    fresh.length === 0 &&
    soon.length === 0 &&
    !showDay &&
    pending.length === 0
  ) {
    return null;
  }

  return (
    <section
      aria-label="Avisos da agenda"
      className="fixed bottom-4 left-4 z-40 flex w-[min(340px,calc(100vw-2rem))] flex-col gap-2.5 md:left-68"
    >
      {shownPending.map((item) => (
        <ConfirmCard
          key={`confirm-${item.id}`}
          item={item}
          isToday={item.date === now.date}
          onDone={() => void pollRef.current()}
          onLater={() => setLater(new Set([...later, item.id]))}
        />
      ))}
      {pending.length > shownPending.length && (
        <Link
          href={agendaHref(pending[shownPending.length])}
          className="rounded-xl border bg-card px-4 py-2.5 text-xs font-medium text-card-foreground shadow-lg hover:bg-muted"
        >
          Mais {pending.length - shownPending.length} aguardando confirmação
        </Link>
      )}
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

/**
 * "Fulano veio?": an appointment whose hour is over, still booked. The two
 * answers are the agenda's own actions, right here; the card goes once the
 * office answers, and comes back on the next load if it chose "Depois".
 */
function ConfirmCard({
  item,
  isToday,
  onDone,
  onLater,
}: {
  item: AgendaAlertItem;
  isToday: boolean;
  onDone: () => void;
  onLater: () => void;
}) {
  const [attended, attend, attending] = useActionState<ActionState, FormData>(
    attendAppointment,
    { status: "idle" },
  );
  const [missed, miss, missing] = useActionState<ActionState, FormData>(
    markAppointmentNoShow,
    { status: "idle" },
  );
  const done = attended.status === "success" || missed.status === "success";
  const error =
    attended.status === "error"
      ? attended.message
      : missed.status === "error"
        ? missed.message
        : undefined;

  // Once: the parent's callback is a new function on every render.
  const reported = useRef(false);
  useEffect(() => {
    if (!done || reported.current) return;
    reported.current = true;
    // A toast, because the card itself leaves with the next refresh. An
    // in-person visit marked attended offers its declaration right there.
    if (attended.status === "success") {
      toast.success(`${item.citizenName}: atendido.`, {
        duration: 10_000,
        ...(item.remote
          ? {}
          : {
              action: {
                label: "Declaração de comparecimento",
                onClick: () =>
                  window.open(
                    `/admin/agenda/comparecimento/${item.id}`,
                    "_blank",
                    "noopener",
                  ),
              },
            }),
      });
    } else {
      toast.success(`${item.citizenName}: não compareceu.`);
    }
    onDone();
  }, [done, onDone, attended.status, item.citizenName, item.id, item.remote]);

  if (done) {
    return (
      <output className="rounded-xl bg-success px-4 py-3 text-sm font-medium text-success-foreground shadow-lg">
        {attended.status === "success"
          ? `${item.citizenName}: atendido.`
          : `${item.citizenName}: não compareceu.`}
      </output>
    );
  }

  const busy = attending || missing;
  return (
    <output className="flex flex-col gap-2 rounded-xl border-2 border-warning bg-card px-4 py-3 text-card-foreground shadow-lg">
      <span className="flex items-start gap-3">
        <AdminIcon
          name="alert"
          className="mt-0.5 h-4.5 w-4.5 flex-none text-warning-text"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">
            {item.citizenName} foi atendido?
          </span>
          <span className="block text-xs text-muted-foreground">
            {isToday ? "Hoje" : formatShortDate(item.date)} às {item.slotTime} ·{" "}
            {item.serviceLabel} · {item.agendaName}
          </span>
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-2 pl-7.5">
        <form action={attend}>
          <input type="hidden" name="id" value={item.id} />
          <Button type="submit" size="sm" disabled={busy}>
            {attending ? "..." : "Atendido"}
          </Button>
        </form>
        <form action={miss}>
          <input type="hidden" name="id" value={item.id} />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={busy}
            className="text-destructive hover:text-destructive"
          >
            {missing ? "..." : "Não compareceu"}
          </Button>
        </form>
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={onLater}
          className="text-muted-foreground underline"
        >
          Depois
        </Button>
      </span>
      {error && (
        <span
          role="alert"
          className="pl-7.5 text-xs font-medium text-destructive"
        >
          {error}
        </span>
      )}
    </output>
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
      className={cn(
        "flex items-start gap-3 rounded-xl px-4 py-3 shadow-lg",
        tone === "strong"
          ? "bg-primary text-primary-foreground motion-safe:animate-attention-pulse"
          : "border bg-card text-card-foreground",
      )}
    >
      <AdminIcon name="calendar" className="mt-0.5 h-4.5 w-4.5 flex-none" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {body && <p className="text-xs opacity-85">{body}</p>}
        <Link
          href={href}
          className="mt-1.5 inline-block text-xs font-medium underline"
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
