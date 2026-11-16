"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isQuietScreen } from "./quiet-screens.ts";

/**
 * Where the office's floating alerts mount: everywhere in the panel but the
 * quiet screens (quiet-screens.ts). Off there, they are not rendered at all,
 * so they neither show nor ring; back on any other screen, they mount again.
 */
export function OfficeAlertsOutlet({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isQuietScreen(pathname)) return null;
  return children;
}
