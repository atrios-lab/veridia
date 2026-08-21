/** Postgres unique violation: someone took the value between read and write. */
export const UNIQUE_VIOLATION = "23505";

/** Postgres foreign key violation: the row is still referenced elsewhere. */
export const FOREIGN_KEY_VIOLATION = "23503";

/**
 * Drizzle wraps the driver's error in one of its own ("Failed query: ..."),
 * and the driver's may itself be wrapped, so the SQLSTATE code is somewhere
 * down the cause chain rather than on the error that was thrown. Reading only
 * the top level silently turns "retry with the next number" into "the request
 * could not be sent", which is exactly the failure this guards.
 */
export function isPostgresError(error: unknown, code: string): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if ((current as { code?: unknown }).code === code) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Which unique constraint a violation names, from wherever in the cause chain
 * the driver's error sits. An insert guarded by two different unique indexes
 * needs this to tell "the slot is taken" from "the number is taken".
 */
export function violatedConstraint(error: unknown): string | undefined {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const name = (current as { constraint_name?: unknown }).constraint_name;
    if (typeof name === "string" && name) return name;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}
