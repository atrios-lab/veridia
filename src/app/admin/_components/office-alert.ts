"use client";

import type { ChannelAlert } from "@/core/alerts/office.ts";
import { playSound } from "../../_components/chat-sound.ts";
import { shakeElement, vibrate } from "../../_components/shake.ts";
import { readAlertPrefs } from "./chat-alert-prefs.ts";

/** The element the dashboard layout gives this id is what shakes. */
const SHAKE_TARGET_ID = "painel";

/**
 * One piece of news, called the way the office chose for its channel
 * (Configurações › Notificações): the tone, the browser's notification and
 * the shake. The card on screen is the caller's to draw or not
 * (`setting.popup`). The volume is this computer's own, set with the chat's.
 */
export function announce(
  setting: ChannelAlert,
  news: { title: string; body: string; tag: string }[],
): void {
  if (!setting.enabled || news.length === 0) return;
  if (setting.sound !== "none") {
    const { volume } = readAlertPrefs();
    if (volume > 0) playSound(setting.sound, volume);
  }
  if (
    setting.notify &&
    typeof Notification !== "undefined" &&
    Notification.permission === "granted"
  ) {
    for (const item of news) {
      try {
        new Notification(item.title, { body: item.body, tag: item.tag });
      } catch {
        // Some browsers only notify from a service worker; the card stays.
      }
    }
  }
  if (setting.shake) {
    shakeElement(document.getElementById(SHAKE_TARGET_ID));
    vibrate();
  }
}
