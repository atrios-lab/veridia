"use client";

import { type ReactNode, useEffect, useState } from "react";

const KEY = "ri-protocol-reminder-later";
const HOUR = 60 * 60 * 1000;

/** "Lembrar depois": hides the reminder on this computer for one hour. */
export function RemindLater({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    let until = 0;
    try {
      until = Number(localStorage.getItem(KEY) ?? 0);
    } catch {
      until = 0;
    }
    setHidden(Date.now() < until);
  }, []);
  if (hidden) return null;
  return (
    <div className="relative">
      {children}
      <button
        type="button"
        onClick={() => {
          try {
            localStorage.setItem(KEY, String(Date.now() + HOUR));
          } catch {
            // Private window: it just hides now.
          }
          setHidden(true);
        }}
        className="absolute right-3 bottom-3 text-xs font-medium text-warning-text underline underline-offset-4 sm:top-1/2 sm:right-32 sm:bottom-auto sm:-translate-y-1/2"
      >
        Lembrar depois
      </button>
    </div>
  );
}
