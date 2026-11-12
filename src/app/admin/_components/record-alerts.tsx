"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ALERT_CHANNEL_LABELS,
  type ChannelAlert,
} from "@/core/alerts/office.ts";
import type {
  RecordAlertChannel,
  RecordAlertItem,
} from "@/lib/guide-requests.ts";
import { recordAlertSnapshotAction } from "../(dashboard)/utilitarios/guias/actions.ts";
import { AdminIcon } from "./icon.tsx";
import { announce } from "./office-alert.ts";

const POLL_MS = 60_000;
const STORAGE_KEY = "record-alerts";

const TITLES: Record<RecordAlertChannel, string> = {
  pedidos: "Novo pedido de serviço",
  lgpd: "Novo requerimento LGPD",
  ouvidoria: "Nova manifestação na ouvidoria",
};

interface Seen {
  since: string;
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
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...seen, dismissed: seen.dismissed.slice(-200) }),
    );
  } catch {
    // Without storage the cards come back on reload: a nuisance, not a fault.
  }
}

/**
 * What comes in through the site on the channels that had no alert of their
 * own: a new service request, a new LGPD request, a new manifestation. Each
 * called as the office chose for its channel (Configurações › Notificações).
 */
export function RecordAlerts({
  settings,
}: {
  settings: Record<RecordAlertChannel, ChannelAlert>;
}) {
  const [items, setItems] = useState<RecordAlertItem[] | null>(null);
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
    const stored = readSeen() ?? {
      since: new Date().toISOString(),
      dismissed: [],
    };
    writeSeen(stored);
    setSeen(stored);
    let stopped = false;
    const poll = async () => {
      try {
        const next = await recordAlertSnapshotAction();
        if (!stopped && next) setItems(next);
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
    items && seen
      ? items.filter(
          (item) =>
            settings[item.channel].enabled &&
            item.at > seen.since &&
            !seen.dismissed.includes(item.key),
        )
      : [];

  useEffect(() => {
    const news = fresh.filter((item) => !announced.current.has(item.key));
    if (news.length === 0) return;
    for (const item of news) announced.current.add(item.key);
    for (const channel of Object.keys(TITLES) as RecordAlertChannel[]) {
      announce(
        settings[channel],
        news
          .filter((item) => item.channel === channel)
          .map((item) => ({
            title: TITLES[channel],
            body: `${item.applicantName ?? "Cidadão"} · ${item.protocolNumber}`,
            tag: item.key,
          })),
      );
    }
  }, [fresh, settings]);

  const cards = fresh.filter((item) => settings[item.channel].popup);
  if (cards.length === 0) return null;
  return (
    // Top left, beside the sidebar: the guias take the top right, the
    // agenda the bottom left and the chat the bottom right.
    <div className="pointer-events-none fixed top-20 left-4 z-40 flex w-[min(320px,calc(100vw-2rem))] flex-col gap-2 md:left-68">
      {cards.slice(0, 4).map((item) => (
        <output
          key={item.key}
          className="pointer-events-auto flex items-start gap-3 rounded-xl border bg-card px-4 py-3 text-card-foreground shadow-lg"
        >
          <AdminIcon
            name="inbox"
            className="mt-0.5 h-4.5 w-4.5 shrink-0 text-primary"
          />
          <span className="min-w-0 flex-1 text-xs leading-snug">
            <strong className="block text-sm font-semibold text-foreground">
              {TITLES[item.channel]}
            </strong>
            {item.applicantName ?? "Cidadão"} · {item.protocolNumber}
            <span className="block text-xs text-muted-foreground">
              {ALERT_CHANNEL_LABELS[item.channel]}
            </span>
            <Link
              href={item.href}
              onClick={() => dismiss(item.key)}
              className="mt-1 block font-medium text-primary underline"
            >
              Abrir
            </Link>
          </span>
          <button
            type="button"
            onClick={() => dismiss(item.key)}
            aria-label="Fechar aviso"
            className="text-muted-foreground hover:text-foreground"
          >
            <AdminIcon name="x" className="h-4 w-4" />
          </button>
        </output>
      ))}
    </div>
  );
}
