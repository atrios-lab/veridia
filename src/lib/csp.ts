// The Content-Security-Policy, as a pure function of what varies: the
// per-request nonce, the environment, and the exact hosts the deploy is
// allowed to load from. src/middleware.ts feeds it and sets the header; the
// reasoning behind the nonce lives there. Kept apart so the policy can be
// asserted in a test without pulling in the edge runtime.

export interface CspInput {
  nonce: string;
  /** Development needs `unsafe-eval` for the dev bundler; nothing else does. */
  isDev: boolean;
  /**
   * The one Vercel Blob store this deploy writes to (BLOB_PUBLIC_HOST):
   * brand images, citizen attachments and the platform's video tutorials
   * all live there, each under its own folder. Undefined without Blob
   * configured (development), and img-src, media-src and connect-src
   * simply do not grow that source: the files are then under `public/`,
   * served by Next itself, which is `'self'`.
   */
  blobPublicHost: string | undefined;
}

// Exact hosts only, never a wildcard, in every directive below.
export function buildCsp({ nonce, isDev, blobPublicHost }: CspInput): string {
  const blob = blobPublicHost ? ` https://${blobPublicHost}` : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ""}`,
    // Next emits inline style attributes; nonceing style-src belongs with
    // the design system change, not here (see next.config.ts).
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${blob}`,
    "font-src 'self'",
    // The <video> and <track> of a tutorial, uploaded to the store by the
    // platform account. Without this directive the default falls back to
    // 'self' and the player shows a broken file.
    `media-src 'self'${blob}`,
    // The citizen's attachments are uploaded by the browser straight to the
    // Blob store, so the page has to be allowed to talk to it: vercel.com is
    // the API the client SDK posts to, and the store's own host is where it
    // is redirected. Without these two the upload is blocked by this very
    // policy and the citizen is back to not being able to attach anything.
    `connect-src 'self' https://vercel.com${blob}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}
