"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChannelAlert } from "@/core/alerts/office.ts";
import { ROUTING_PURPOSE_LABELS } from "@/core/routing/routing.ts";
import type { RoutingAlert, RoutingAlertKind } from "@/lib/routing.ts";
import { routingAlertSnapshotAction } from "../(dashboard)/pedidos/[protocolo]/routing-actions.ts";
import { AlertOverflow } from "./alert-dock.tsx";
import { AdminIcon } from "./icon.tsx";
import { announce } from "./office-alert.ts";

const POLL_MS = 45_000;
const STORAGE_KEY = "routing-alerts";
const MAX_CARDS = 3;

const TITLES: Record<RoutingAlertKind, string> = {
  routed: "Pedido direcionado a você",
  taken: "Pegaram um pedido que estava com você",
  unreceived: "Pedido ainda não recebido",
  overdue: "Prazo de direcionamento vencido",
};

function body(alert: RoutingAlert): string {
  const purpose =
    ROUTING_PURPOSE_LABELS[alert.purpose].toLocaleLowerCase("pt-BR");
  switch (alert.kind) {
    case "routed":
      return `${alert.who}: ${alert.protocolNumber} para ${purpose}${alert.sectorLabel ? ` · ${alert.sectorLabel}` : ""}`;
    case "taken":
      return `${alert.who} pegou o ${alert.protocolNumber}`;
    case "unreceived":
      return `${alert.protocolNumber}: ${alert.who} ainda não recebeu (há mais de 2 horas)`;
    case "overdue":
      return `${alert.protocolNumber}: com ${alert.who}, para ${purpose}`;
  }
}

interface Seen {
  dismissed: string[];
}

function readSeen(): Seen {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Seen) : { dismissed: [] };
  } catch {
    return { dismissed: [] };
  }
}

function writeSeen(seen: Seen): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ dismissed: seen.dismissed.slice(-300) }),
    );
  } catch {
    // Without storage a closed card comes back on reload: a nuisance.
  }
}

/**
 * The routing channel (change direcionamento-interno-de-pedidos): a card,
 * a tone and the browser's notification, as the office chose in
 * Configurações › Notificações, on every screen of the panel.
 */
export function RoutingAlerts({ setting }: { setting: ChannelAlert }) {
  const [items, setItems] = useState<RoutingAlert[] | null>(null);
  const [seen, setSeen] = useState<Seen | null>(null);
  const announced = useRef(new Set<string>());

  const dismissMany = useCallback((keys: string[]) => {
    setSeen((current) => {
      const next = { dismissed: [...(current?.dismissed ?? []), ...keys] };
      writeSeen(next);
      return next;
    });
  }, []);

  useEffect(() => {
    setSeen(readSeen());
    let stopped = false;
    const poll = async () => {
      try {
        const next = await routingAlertSnapshotAction();
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
    items && seen && setting.enabled
      ? items.filter((item) => !seen.dismissed.includes(item.key))
      : [];

  useEffect(() => {
    const news = fresh.filter((item) => !announced.current.has(item.key));
    if (news.length === 0) return;
    for (const item of news) announced.current.add(item.key);
    announce(
      setting,
      news.map((item) => ({
        title: TITLES[item.kind],
        body: body(item),
        tag: item.key,
      })),
    );
  }, [fresh, setting]);

  if (!setting.popup) return null;
  const cards = [...fresh].sort(
    (a, b) =>
      Number(b.priority === "urgent") - Number(a.priority === "urgent") ||
      b.at.localeCompare(a.at),
  );
  if (cards.length === 0) return null;
  const hidden = cards.slice(MAX_CARDS);
  return (
    <div className="pointer-events-auto flex flex-col gap-2">
      {cards.slice(0, MAX_CARDS).map((item) => (
        <output
          key={item.key}
          className={`flex items-start gap-3 rounded-xl border border-l-4 bg-card px-4 py-3 text-card-foreground shadow-lg ${
            item.kind === "overdue" || item.priority === "urgent"
              ? "border-l-destructive"
              : item.priority === "attention" || item.kind === "unreceived"
                ? "border-l-warning"
                : "border-l-primary"
          }`}
        >
          <AdminIcon
            name="shuffle"
            className="mt-0.5 h-4.5 w-4.5 shrink-0 text-primary"
          />
          <span className="min-w-0 flex-1 text-xs leading-snug">
            <strong className="block text-sm font-semibold text-foreground">
              {TITLES[item.kind]}
              {item.priority === "urgent"
                ? " · Urgente"
                : item.priority === "attention"
                  ? " · ⚠ Atenção"
                  : ""}
            </strong>
            {body(item)}
            {item.note && item.kind === "routed" && (
              <span className="block text-muted-foreground">"{item.note}"</span>
            )}
            <Link
              href={item.kind === "routed" ? "/admin/direcionados" : item.href}
              onClick={() => dismissMany([item.key])}
              className="mt-1 block font-medium text-primary underline"
            >
              {item.kind === "routed" ? "Ver e receber" : "Abrir o pedido"}
            </Link>
          </span>
          <button
            type="button"
            onClick={() => dismissMany([item.key])}
            aria-label="Fechar aviso"
            className="text-muted-foreground hover:text-foreground"
          >
            <AdminIcon name="x" className="h-4 w-4" />
          </button>
        </output>
      ))}
      <AlertOverflow
        hidden={hidden.length}
        noun={hidden.length === 1 ? "aviso novo" : "avisos novos"}
        onDismissAll={() => dismissMany(hidden.map((item) => item.key))}
      />
    </div>
  );
}
