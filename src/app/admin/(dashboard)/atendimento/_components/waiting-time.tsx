"use client";

import { useEffect, useState } from "react";

const TICK_MS = 15_000;

function waitMinutes(waitingSince: string, now: number): number {
  return Math.floor((now - new Date(waitingSince).getTime()) / 60_000);
}

function urgencyClass(minutes: number): string {
  if (minutes >= 10) return "text-admin-error-text";
  if (minutes >= 5) return "text-admin-warning-text";
  return "text-admin-success-text";
}

/**
 * The "N min" badge next to someone waiting, ticking on its own client-side
 * clock instead of riding the page's `router.refresh()` cadence: the queue
 * now only refreshes when who's waiting actually changes (see
 * `QueuePoller`), and this is what keeps the number climbing in between.
 */
export function WaitingTime({ waitingSince }: { waitingSince: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const minutes = waitMinutes(waitingSince, now);
  return (
    <span
      className={`flex-none text-[12px] font-bold ${urgencyClass(minutes)}`}
    >
      {minutes} min
    </span>
  );
}
