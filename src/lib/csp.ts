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
  /**
   * Who may show this response inside a frame. `'none'` everywhere except
   * the two public transparency PDFs, which the transparency page shows in a
   * dialog of its own (see `isFramablePdfPath`). Defaults to `'none'`, so a
   * caller that forgets it gets the closed door, not the open one.
   */
  frameAncestors?: "none" | "self";
}

// Exactly one id segment after the prefix: "/transparencia/boletim/<id>" is
// a PDF, "/transparencia/boletim/<id>/extra" or "/transparencia/documentos"
// is not, and keeps the site-wide refusal.
const FRAMABLE_PDF_PATH = /^\/transparencia\/(documento|boletim)\/[^/]+$/;

/**
 * Whether a path is one of the public transparency PDFs the transparency
 * page may show in a frame of its own origin. Every other route stays
 * unframable, the panel included.
 */
export function isFramablePdfPath(pathname: string): boolean {
  return FRAMABLE_PDF_PATH.test(pathname);
}

// Exact hosts only, never a wildcard, in every directive below.
export function buildCsp({
  nonce,
  isDev,
  blobPublicHost,
  frameAncestors = "none",
}: CspInput): string {
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
    // 'self' and the player shows a broken file. `blob:` is for the upload
    // form, which reads a video's duration by loading the picked file into
    // an off-screen <video> through an object URL before any byte is sent.
    `media-src 'self' blob:${blob}`,
    // The citizen's attachments are uploaded by the browser straight to the
    // Blob store, so the page has to be allowed to talk to it: vercel.com is
    // the API the client SDK posts to, and the store's own host is where it
    // is redirected. Without these two the upload is blocked by this very
    // policy and the citizen is back to not being able to attach anything.
    `connect-src 'self' https://vercel.com${blob}`,
    `frame-ancestors '${frameAncestors}'`,
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}
