/**
 * "Chamar atenção", both ways, the way the messengers of the 2000s did: the
 * screen of whoever is called shakes and rings (and a phone vibrates).
 *
 * The office may call the citizen whenever it wants: it is the office's own
 * conversation to keep moving. The citizen may call only after ten minutes
 * without an answer, and then once every ten minutes: a call for attention,
 * not a way to flood the counter.
 *
 * The clock starts at the latest of: the conversation opening, the office's
 * last reply, and the citizen's last call. A reply from the office resets
 * it, which is the point: the button is for when nobody has answered.
 */
export const NUDGE_COOLDOWN_MINUTES = 10;

/**
 * The lines a call leaves in the conversation, for both sides to read. Each
 * is a system line with this exact text, which is also how each side finds
 * the other's calls (alertSnapshotWith in lib/chat.ts for the panel, the
 * widget for the citizen): no column of their own.
 */
export const CITIZEN_NUDGE_MESSAGE =
  "O cidadão chamou a atenção do atendimento.";
export const OFFICE_NUDGE_MESSAGE = "O cartório chamou a sua atenção.";

/** Who pressed "Chamar atenção". */
export type NudgeBy = "citizen" | "office";

export function nudgeMessage(by: NudgeBy): string {
  return by === "citizen" ? CITIZEN_NUDGE_MESSAGE : OFFICE_NUDGE_MESSAGE;
}

/** Whether a conversation line is the office calling the citizen. */
export function isOfficeNudge(message: {
  authorType: string;
  body: string;
}): boolean {
  return (
    message.authorType === "system" && message.body === OFFICE_NUDGE_MESSAGE
  );
}

export type NudgeState = {
  startedAt: Date;
  lastStaffMessageAt: Date | null;
  lastNudgeAt: Date | null;
};

/** When the citizen's button may be pressed next. */
export function nudgeAvailableAt(state: NudgeState): Date {
  const latest = Math.max(
    state.startedAt.getTime(),
    state.lastStaffMessageAt?.getTime() ?? 0,
    state.lastNudgeAt?.getTime() ?? 0,
  );
  return new Date(latest + NUDGE_COOLDOWN_MINUTES * 60_000);
}

export function canNudge(state: NudgeState, now: Date): boolean {
  return now.getTime() >= nudgeAvailableAt(state).getTime();
}

/** "em 7 min", for the button while it waits. Rounded up: never "em 0 min". */
export function nudgeWaitLabel(availableAt: Date, now: Date): string {
  const minutes = Math.max(
    1,
    Math.ceil((availableAt.getTime() - now.getTime()) / 60_000),
  );
  return `em ${minutes} min`;
}
