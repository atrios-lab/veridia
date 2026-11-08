"use client";

/**
 * "Chamar atenção" on screen, shared by the panel and the citizen's chat:
 * the element shakes once (chat-shake in globals.css, behind
 * `motion-safe:`) and a phone vibrates where the browser offers it. A
 * desktop browser has no vibration and simply ignores the call.
 */

// Written out whole so Tailwind sees the class in source.
const SHAKE_CLASS = "motion-safe:animate-chat-shake";

export function shakeElement(target: HTMLElement | null): void {
  if (!target) return;
  target.classList.remove(SHAKE_CLASS);
  // Reading layout restarts the animation when two calls land close.
  void target.offsetWidth;
  target.classList.add(SHAKE_CLASS);
  target.addEventListener(
    "animationend",
    () => target.classList.remove(SHAKE_CLASS),
    { once: true },
  );
}

/** A short buzz pattern, the phone's version of the shake. */
export function vibrate(): void {
  try {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.vibrate === "function" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      navigator.vibrate([200, 100, 200, 100, 300]);
    }
  } catch {
    // No vibration here; the shake and the sound still carry the call.
  }
}
