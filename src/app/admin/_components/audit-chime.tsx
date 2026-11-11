"use client";

import { useEffect } from "react";
import type { ChannelAlert } from "@/core/alerts/office.ts";
import { playSound, unlockAudio } from "../../_components/chat-sound.ts";

const KEY = "veridia.audit.seen";

/**
 * The audit's channel (Configurações › Notificações › Auditoria): rings
 * once when the number of things waiting grows (a new notification, a new
 * urgent act), with the browser's notice when allowed.
 */
export function AuditChime({
  count,
  setting,
}: {
  count: number;
  setting: ChannelAlert;
}) {
  useEffect(() => {
    let seen = 0;
    try {
      seen = Number(window.localStorage.getItem(KEY) ?? 0);
      window.localStorage.setItem(KEY, String(count));
    } catch {
      // Private window: it rings each time, which errs on the safe side.
    }
    if (count <= seen) return;
    const ring = () => {
      if (setting.sound !== "none") playSound(setting.sound, 80);
    };
    ring();
    // The browser keeps sound locked until a click: ring at the first one.
    const unlock = () => void unlockAudio().then(ring);
    window.addEventListener("pointerdown", unlock, { once: true });
    if (
      setting.notify &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      new Notification("Auditoria", {
        body: "Há algo novo na auditoria esperando por você.",
        tag: "auditoria",
      });
    }
    return () => window.removeEventListener("pointerdown", unlock);
  }, [count, setting]);
  return null;
}
