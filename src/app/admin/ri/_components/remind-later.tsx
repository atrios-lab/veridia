"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

const KEY = "ri-protocol-reminder-later";
const EVENT = "ri-protocol-reminder-later";
const HOUR = 60 * 60 * 1000;

/** Hides the reminder on this computer for one hour. */
export function RemindLater({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(true);
  const pathname = usePathname();
  // The Mesa and the Protocolo show the same in their own place ("Agora",
  // "Hoje"), so the bar on top would only repeat it (decision of 28/11/2026).
  const ownPlace =
    pathname === "/admin/ri" || pathname.startsWith("/admin/ri/protocolo");
  useEffect(() => {
    let until = 0;
    try {
      until = Number(localStorage.getItem(KEY) ?? 0);
    } catch {
      until = 0;
    }
    setHidden(Date.now() < until);
    const hide = () => setHidden(true);
    window.addEventListener(EVENT, hide);
    return () => window.removeEventListener(EVENT, hide);
  }, []);
  if (hidden || ownPlace) return null;
  return <>{children}</>;
}

/** "Lembrar depois": sits with the other actions, never over the text. */
export function LaterButton() {
  return (
    <button
      type="button"
      onClick={() => {
        try {
          localStorage.setItem(KEY, String(Date.now() + HOUR));
        } catch {
          // Private window: it just hides now.
        }
        window.dispatchEvent(new Event(EVENT));
      }}
      className="inline-flex h-8 items-center rounded-md px-2 text-sm font-medium text-warning-text underline underline-offset-4 hover:bg-warning/10"
    >
      Lembrar depois
    </button>
  );
}
