import type { ConversationStatus } from "./conversation.ts";

// 10 minutes without a word from the citizen closes the conversation
// automatically; the warning fires two minutes before that, at 8. Both are
// read from the same clock: the citizen's last message, never the
// attendant's — an attendant typing does not keep a silent citizen "active".
export const INACTIVITY_TIMEOUT_MINUTES = 10;
export const INACTIVITY_WARNING_MINUTES = 8;

interface ActivityState {
  status: ConversationStatus;
  lastActivityAt: Date;
}

function minutesSince(instant: Date, now: Date): number {
  return (now.getTime() - instant.getTime()) / 60_000;
}

/**
 * Whether an `active` conversation has gone quiet long enough to close on
 * its own. Evaluated lazily wherever a conversation is read — see
 * design.md, "Inatividade e fechamento automático avaliados de forma
 * preguiçosa, sem cron" — never by a scheduled job.
 */
export function isStale(conversation: ActivityState, now: Date): boolean {
  if (conversation.status !== "active") return false;
  return (
    minutesSince(conversation.lastActivityAt, now) >= INACTIVITY_TIMEOUT_MINUTES
  );
}

/** Whether the "Ainda está aí?" warning belongs on screen right now. */
export function needsInactivityWarning(
  conversation: ActivityState,
  now: Date,
): boolean {
  if (conversation.status !== "active") return false;
  const idle = minutesSince(conversation.lastActivityAt, now);
  return (
    idle >= INACTIVITY_WARNING_MINUTES && idle < INACTIVITY_TIMEOUT_MINUTES
  );
}
