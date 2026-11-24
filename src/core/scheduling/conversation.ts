/**
 * The exigência and the questions of an appointment (decision of
 * 24/11/2026), as pure rules over the stored rows: what is shown, what is
 * still open and whether the citizen may write. The rows live in
 * `appointment_messages`; nothing here reads the database.
 */

export const CONVERSATION_KINDS = [
  "requirement",
  "message",
  "open",
  "close",
] as const;
export type ConversationKind = (typeof CONVERSATION_KINDS)[number];

export type ConversationAuthor = "office" | "citizen";

/** The most a citizen's message may say: a question, not a petition. */
export const CITIZEN_MESSAGE_MAX = 2000;

export interface ConversationRow {
  id: string;
  kind: string;
  authorType: string;
  authorName: string;
  body: string;
  resolvedAt: Date | null;
  editedAt: Date | null;
  hiddenAt: Date | null;
  createdAt: Date;
}

/** What is still shown: "apagar" only hides. */
export function shownRows<T extends Pick<ConversationRow, "hiddenAt">>(
  rows: readonly T[],
): T[] {
  return rows.filter((row) => !row.hiddenAt);
}

/** Whether the office left the questions open: the latest open/close
 * says. Closed until the office opens them. */
export function questionsOpen(
  rows: readonly Pick<ConversationRow, "kind" | "hiddenAt" | "createdAt">[],
): boolean {
  const toggles = shownRows(rows)
    .filter((row) => row.kind === "open" || row.kind === "close")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return toggles.at(-1)?.kind === "open";
}

/** The exigências still waiting on the citizen. */
export function openRequirements<
  T extends Pick<ConversationRow, "kind" | "hiddenAt" | "resolvedAt">,
>(rows: readonly T[]): T[] {
  return shownRows(rows).filter(
    (row) => row.kind === "requirement" && !row.resolvedAt,
  );
}

/**
 * Whether the citizen may write now: the questions open and the
 * appointment still ahead. A closed conversation stays readable.
 */
export function citizenMayWrite(
  rows: readonly Pick<ConversationRow, "kind" | "hiddenAt" | "createdAt">[],
  appointmentOpen: boolean,
): boolean {
  return appointmentOpen && questionsOpen(rows);
}

/** The citizen's last word with nothing from the office after it: the
 * panel flags it as waiting for an answer. */
export function awaitingOffice(
  rows: readonly Pick<
    ConversationRow,
    "kind" | "authorType" | "hiddenAt" | "createdAt"
  >[],
): boolean {
  const messages = shownRows(rows)
    .filter((row) => row.kind === "message")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return messages.at(-1)?.authorType === "citizen";
}
