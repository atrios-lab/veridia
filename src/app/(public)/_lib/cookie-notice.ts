// Shared between the server (layout.tsx, deciding whether to render the
// banner) and the client (cookie-notice.tsx, writing the acknowledgement).
export const COOKIE_NOTICE_COOKIE = "cookie_notice_ack";
export const COOKIE_NOTICE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
