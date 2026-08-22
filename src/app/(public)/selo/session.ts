/**
 * The TJ session travels in the citizen's own cookie, and nowhere else.
 *
 * It is not a secret of ours to keep: it is the session the citizen holds on
 * a public lookup that has no login, so giving it back to its owner costs no
 * server state, works the same in development as in production, and leaves
 * nothing behind when the consultation ends.
 */
export const SEAL_SESSION_COOKIE = "tj-seal-session";

/** Long enough to read a captcha and type a code, short enough to expire. */
export const SEAL_SESSION_MAX_AGE = 10 * 60;
