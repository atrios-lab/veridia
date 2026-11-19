"use client";

import { useEffect, useRef, useState } from "react";
import { EMOJI_CATEGORIES, pushRecent } from "@/core/messages/emoji.ts";
import { cn } from "../../_ui/cn.ts";

const RECENT_KEY = "veridia.mensagens.emojis-recentes";

function readRecent(): string[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(saved)
      ? saved.filter((e): e is string => typeof e === "string")
      : [];
  } catch {
    return [];
  }
}

/** Remembers an emoji as recent, for the next time the picker opens. */
export function rememberEmoji(emoji: string) {
  try {
    window.localStorage.setItem(
      RECENT_KEY,
      JSON.stringify(pushRecent(readRecent(), emoji)),
    );
  } catch {
    // A private window: the picker just has no recent ones.
  }
}

/**
 * The emoji picker (decision of 19/11/2026), laid out as people know it from
 * the phone: a row of tabs, one per category, with the recent ones first,
 * and a grid under them. Closes on Escape or a click outside.
 */
export function EmojiPicker({
  onPick,
  onClose,
  className,
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
  className?: string;
}) {
  const [recent, setRecent] = useState<string[]>([]);
  const [tab, setTab] = useState("recentes");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = readRecent();
    setRecent(saved);
    if (saved.length === 0) setTab(EMOJI_CATEGORIES[0].id);
  }, []);

  useEffect(() => {
    const away = (event: PointerEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    // On the next tick: the click that opened the picker must not close it.
    const timer = setTimeout(() => {
      document.addEventListener("pointerdown", away);
      document.addEventListener("keydown", onKey);
    });
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const tabs = [
    ...(recent.length
      ? [{ id: "recentes", label: "Recentes", icon: "🕘", emojis: recent }]
      : []),
    ...EMOJI_CATEGORIES,
  ];
  const current = tabs.find((t) => t.id === tab) ?? tabs[0];

  return (
    <div
      ref={box}
      role="dialog"
      aria-label="Escolher emoji"
      className={cn(
        "z-30 flex w-[320px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg",
        className,
      )}
    >
      <div
        role="tablist"
        aria-label="Categorias de emoji"
        className="flex gap-0.5 border-b border-border bg-msg-pane px-1.5 pt-1.5"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === current.id}
            aria-label={t.label}
            title={t.label}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 cursor-pointer rounded-t-md border-b-2 px-1 py-1.5 text-lg leading-none transition-colors",
              t.id === current.id
                ? "border-primary bg-card"
                : "border-transparent opacity-70 hover:opacity-100",
            )}
          >
            {t.icon}
          </button>
        ))}
      </div>
      <p className="px-3 pt-2 text-xs font-semibold text-muted-foreground">
        {current.label}
      </p>
      <div
        role="tabpanel"
        className="grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto p-2"
      >
        {current.emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => {
              rememberEmoji(emoji);
              setRecent(readRecent());
              onPick(emoji);
            }}
            className="flex aspect-square cursor-pointer items-center justify-center rounded-md text-xl leading-none hover:bg-muted"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
