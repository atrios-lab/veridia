"use client";

import { useRouter } from "next/navigation";
import { useLiveVersion } from "../../../../_components/use-live-version.ts";
import { queueVersionAction } from "../actions.ts";

const QUEUE_POLL_MS = 5000;

/**
 * Keeps the queue screen current without a blind interval refresh: reads
 * the cheap id signature from `queueVersionAction` and only asks for a real
 * `router.refresh()` when who's waiting or being attended actually changed.
 * `useLiveVersion` already pauses while the tab isn't visible, same
 * discipline as the rest of the panel's live screens.
 */
export function QueuePoller({ version }: { version: string }) {
  const router = useRouter();
  useLiveVersion(
    queueVersionAction,
    version,
    () => router.refresh(),
    QUEUE_POLL_MS,
  );
  return null;
}
