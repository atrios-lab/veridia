"use client";

import { useEffect, useState } from "react";
import {
  type AlertPrefs,
  DEFAULT_ALERT_PREFS,
  parseAlertPrefs,
} from "@/core/chat/alerts.ts";

/**
 * The attendant's alert choices, kept in this browser's localStorage: each
 * computer at the counter has its own speakers, its own volume and its own
 * notification permission, so the setting belongs to the machine, not the
 * account. Every read and write is guarded: storage can be off (private
 * window, blocked site data), and then the defaults simply apply.
 */
const KEY = "veridia:chat-alerts";
const CHANGED = "veridia:chat-alerts-changed";

export function readAlertPrefs(): AlertPrefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    return parseAlertPrefs(raw ? JSON.parse(raw) : {});
  } catch {
    return DEFAULT_ALERT_PREFS;
  }
}

export function saveAlertPrefs(prefs: AlertPrefs): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Not saved, but still applied to this tab below.
  }
  window.dispatchEvent(new CustomEvent(CHANGED, { detail: prefs }));
}

/** The current choices, following changes made in this tab or another. */
export function useAlertPrefs(): AlertPrefs {
  const [prefs, setPrefs] = useState<AlertPrefs>(DEFAULT_ALERT_PREFS);
  useEffect(() => {
    setPrefs(readAlertPrefs());
    const onChange = (event: Event) =>
      setPrefs(
        event instanceof CustomEvent
          ? parseAlertPrefs(event.detail)
          : readAlertPrefs(),
      );
    window.addEventListener(CHANGED, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CHANGED, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return prefs;
}
