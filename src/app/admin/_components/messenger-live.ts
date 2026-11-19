"use client";

import { TYPING_PING_MS } from "@/core/messages/live.ts";

/**
 * The panel's one live connection to the internal messenger (decision of
 * 19/11/2026). The watcher on every screen, the messenger page and the
 * floating window all listen to the same EventSource, so a tab holds one
 * connection however many of them are on screen. When the server says
 * "change", each fetches what it shows; "typing" carries who is typing.
 */

export interface TypingNow {
  userId: string;
  conversationId: string;
}

interface Listener {
  /** Something this person can see changed: fetch it now. */
  onChange?: () => void;
  /** (Re)connected: whatever happened while away is fetched too. */
  onReady?: () => void;
  onTyping?: (typing: TypingNow[]) => void;
}

const EVENTS_URL = "/admin/mensagens/eventos";
const listeners = new Set<Listener>();
let source: EventSource | null = null;
let typingNow: TypingNow[] = [];
let connected = false;

function each(call: (listener: Listener) => void) {
  for (const listener of [...listeners]) call(listener);
}

function connect() {
  if (source || typeof window === "undefined" || !("EventSource" in window))
    return;
  source = new EventSource(EVENTS_URL);
  source.addEventListener("ready", () => {
    connected = true;
    each((l) => l.onReady?.());
  });
  source.addEventListener("change", () => each((l) => l.onChange?.()));
  source.addEventListener("typing", (event) => {
    try {
      typingNow = JSON.parse((event as MessageEvent<string>).data);
    } catch {
      typingNow = [];
    }
    each((l) => l.onTyping?.(typingNow));
  });
  source.addEventListener("error", () => {
    connected = false;
    // A refused connection (403) ends for good; try again in a while, in
    // case it was the session expiring. A dropped one reconnects by itself.
    if (source?.readyState === EventSource.CLOSED) {
      source = null;
      setTimeout(() => listeners.size && connect(), 30_000);
    }
  });
}

/** Listens while mounted; the last one to leave closes the connection. */
export function subscribeMessenger(listener: Listener): () => void {
  listeners.add(listener);
  connect();
  if (typingNow.length) listener.onTyping?.(typingNow);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && source) {
      source.close();
      source = null;
      connected = false;
    }
  };
}

/** Whether the live connection is up: the screens ask less often then. */
export function isLive(): boolean {
  return connected;
}

/* ------------------------------------------------------- open on screen */

let openConversation: string | null = null;

/** The conversation open on the messenger screen, for the sound rules. */
export function setOpenConversation(id: string | null) {
  openConversation = id;
}

export function getOpenConversation(): string | null {
  return openConversation;
}

/* --------------------------------------------------------------- typing */

let lastPing = { conversationId: "", at: 0 };

function post(conversationId: string | null) {
  void fetch("/admin/mensagens/digitando", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId }),
    keepalive: true,
  }).catch(() => {
    // A lost ping only means "digitando…" shows a moment late.
  });
}

/** Called on every key press: says "typing" at most every 2.5 seconds. */
export function pingTyping(conversationId: string) {
  const now = Date.now();
  if (
    lastPing.conversationId === conversationId &&
    now - lastPing.at < TYPING_PING_MS
  )
    return;
  lastPing = { conversationId, at: now };
  post(conversationId);
}

/** The box was emptied or the message sent: "digitando…" goes at once. */
export function stopTyping() {
  if (!lastPing.conversationId) return;
  lastPing = { conversationId: "", at: 0 };
  post(null);
}
