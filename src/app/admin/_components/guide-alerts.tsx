"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChannelAlert } from "@/core/alerts/office.ts";
import type { GuideAlertItem } from "@/lib/guide-requests.ts";
import { guideAlertSnapshotAction } from "../(dashboard)/utilitarios/guias/actions.ts";
import { AdminIcon } from "./icon.tsx";
import { announce } from "./office-alert.ts";

/** Once a minute, like the agenda's alert. */
const POLL_MS = 60_000;
const STORAGE_KEY = "guide-alerts";

interface Seen {
  /** News from before this instant is not news. */
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
 * The guias de transmissão de bens in the panel, on every screen, for whoever works
 * requests: each new request from the site and each one the citizen moved
 * (a document, an answer, a comprovante), with a tone and the browser's
 * notification, as the agenda and the chat do. Each card closes by hand and
 * stays closed on this computer.
 */
export function GuideAlerts({ setting }: { setting: ChannelAlert }) {
  const [items, setItems] = useState<GuideAlertItem[] | null>(null);
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
        const next = await guideAlertSnapshotAction();
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
          (item) => item.at > seen.since && !seen.dismissed.includes(item.key),
        )
      : [];

  useEffect(() => {
    const news = fresh.filter((item) => !announced.current.has(item.key));
    if (news.length === 0) return;
    for (const item of news) announced.current.add(item.key);
    // As the office chose for the guias (Configurações › Notificações).
    announce(
      setting,
      news.map((item) => ({
        title:
          item.kind === "new"
            ? "Nova guia de transmissão de bens"
            : "Guia de transmissão de bens atualizada",
        body: `${item.applicantName ?? "Cidadão"} · ${item.protocolNumber}`,
        tag: `guia:${item.key}`,
      })),
    );
  }, [fresh, setting]);

  if (fresh.length === 0 || !setting.enabled || !setting.popup) return null;
  return (
    // Top right: the agenda's cards take the bottom left and the chat's the
    // bottom right.
    <div className="pointer-events-none fixed top-20 right-4 z-40 flex w-[min(320px,calc(100vw-2rem))] flex-col gap-2">
      {fresh.slice(0, 4).map((item) => (
        <output
          key={item.key}
          className="pointer-events-auto flex items-start gap-3 rounded-xl bg-admin-primary px-4 py-3 text-white shadow-xl"
        >
          <AdminIcon
            name="calculator"
            className="mt-0.5 h-4.5 w-4.5 shrink-0"
          />
          <span className="min-w-0 flex-1 text-[12.5px] leading-snug">
            <strong className="block text-[13px]">
              {item.kind === "new"
                ? "Nova guia de transmissão de bens"
                : "Cliente atualizou a guia"}
            </strong>
            {item.applicantName ?? "Cidadão"} · {item.protocolNumber}
            <Link
              href={`/admin/pedidos/${encodeURIComponent(item.protocolNumber)}`}
              onClick={() => dismiss(item.key)}
              className="mt-1 block font-semibold underline"
            >
              Abrir o pedido
            </Link>
          </span>
          <button
            type="button"
            onClick={() => dismiss(item.key)}
            aria-label="Fechar aviso"
            className="text-white/80 hover:text-white"
          >
            <AdminIcon name="x" className="h-4 w-4" />
          </button>
        </output>
      ))}
    </div>
  );
}
