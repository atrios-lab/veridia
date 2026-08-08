/** How many `active` conversations one attendant may hold at once. */
export const MAX_CONCURRENT_CONVERSATIONS = 3;

/**
 * Whether "Atender" may assign one more conversation to someone already
 * holding `activeCount` of them. Checked at the moment of the action, not
 * reserved ahead of time — see design.md, "Limite de 3 conversas é checado
 * na ação, não reservado".
 */
export function canAssign(activeCount: number): boolean {
  return activeCount < MAX_CONCURRENT_CONVERSATIONS;
}
