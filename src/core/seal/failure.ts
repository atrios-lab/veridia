/**
 * What a failed exchange with the TJRN's SIEX leaves in the server log.
 *
 * Every failure used to collapse into `undefined` and a 502 "O TJ não
 * respondeu.", which is the right thing to show the citizen and useless to
 * whoever has to find out why: a 403 from the TJ's CDN, a timeout and a DNS
 * error all looked the same. This is the one line that tells them apart.
 *
 * Built from the shape of the failure only, never from what travelled in the
 * request: the session is the citizen's, and a seal code leads to the name
 * and CPF of whoever presented the act. That is also why a network error is
 * described by its name and code and never by its message, which is free
 * text nobody here controls.
 */

/** The three requests of a lookup, in the order a citizen makes them. */
export type TjStep = "session" | "captcha" | "lookup";

export type TjFailureCause =
  /** The TJ answered, with something other than success. */
  | { status: number }
  /** The TJ answered 200 to the session request without opening one. */
  | { missingSession: true }
  /** No answer at all: timeout, refused connection, DNS. */
  | { error: unknown };

export interface TjFailure {
  step: TjStep;
  status?: number;
  reason: string;
  /** Where the function ran, which is the question the TJ's CDN answers. */
  region?: string;
}

function reasonOf(error: unknown): string {
  if (!(error instanceof Error)) return "unknown";
  // AbortSignal.timeout() aborts with a DOMException named TimeoutError.
  if (error.name === "TimeoutError") return "timeout";
  // fetch wraps the socket error ("fetch failed"); its cause carries the code.
  const code = (error.cause as { code?: unknown } | undefined)?.code;
  return typeof code === "string" ? `${error.name}:${code}` : error.name;
}

export function describeTjFailure(
  step: TjStep,
  cause: TjFailureCause,
  region?: string,
): TjFailure {
  const where = region ? { region } : {};
  if ("status" in cause) {
    return { step, status: cause.status, reason: "http", ...where };
  }
  if ("missingSession" in cause) {
    return { step, reason: "no-session", ...where };
  }
  return { step, reason: reasonOf(cause.error), ...where };
}
