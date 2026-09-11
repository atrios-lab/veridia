import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The short-lived link a citizen's PDF is served from.
 *
 * The form still posts protocol and access key in its body, and the route
 * still verifies the key. But the browser's PDF viewer does not save the
 * bytes it already holds: its download button fetches the tab's URL again,
 * by GET. A tab reached by POST has no GET to repeat, so the route answers
 * the POST with a redirect to a GET address that carries only this token.
 *
 * The token names one document of one request of one tenant, for a short
 * while. It never carries the access key and cannot be turned back into it:
 * the key is the citizen's only credential, and a URL is the one place it
 * must not end up (browser history, proxy logs, a screenshot of the address
 * bar). What a leaked token gives up is this one file, until it expires.
 *
 * Pure: the signing key comes in as a parameter, the clock too, so the
 * behaviour is pinned down by a test with no environment behind it.
 */

/** The documents a link may name. The access receipt is not one of them by
 * construction: it prints the key, and a link that could serve it would be
 * the key. */
export const LINKABLE_DOCUMENTS = ["requerimento", "declaracao"] as const;
export type LinkableDocument = (typeof LINKABLE_DOCUMENTS)[number];

export interface PdfLink {
  tenantSlug: string;
  protocolNumber: string;
  documento: LinkableDocument;
  /** Unix time, in seconds. */
  expiresAt: number;
}

/** How long a link stays good after the POST that issued it. Enough to open,
 * read and save; short enough that a URL left in a browser's history goes
 * stale before it is found. */
export const PDF_LINK_TTL_SECONDS = 60 * 60;

// The version prefix is signed along with the payload, so a token minted
// under a future format cannot be presented to this one.
const SIGNED_PREFIX = "pdf-link:v1.";

function sign(payload: string, key: Buffer): string {
  return createHmac("sha256", key)
    .update(SIGNED_PREFIX + payload)
    .digest("base64url");
}

export function signPdfLink(link: PdfLink, key: Buffer): string {
  const payload = Buffer.from(
    JSON.stringify({
      t: link.tenantSlug,
      p: link.protocolNumber,
      d: link.documento,
      e: link.expiresAt,
    }),
  ).toString("base64url");
  return `${payload}.${sign(payload, key)}`;
}

function isLinkable(value: unknown): value is LinkableDocument {
  return (
    typeof value === "string" &&
    (LINKABLE_DOCUMENTS as readonly string[]).includes(value)
  );
}

/**
 * The link a token stands for, or null: wrong signature, altered payload,
 * expired, or a shape this code never produced. One null for every failure,
 * on purpose. The route answers all of them with the same 404 it gives a
 * wrong access key, and a caller that could tell "expired" from "forged"
 * would be handing a probe its first bit of information.
 *
 * Never throws: everything here came off a URL, and a malformed one is a
 * request to refuse, not an exception to log.
 */
export function verifyPdfLink(
  token: string,
  key: Buffer,
  now: number,
): PdfLink | null {
  const cut = token.indexOf(".");
  if (cut <= 0 || cut === token.length - 1) return null;
  const payload = token.slice(0, cut);
  const presented = Buffer.from(token.slice(cut + 1), "base64url");
  const expected = Buffer.from(sign(payload, key), "base64url");
  // Length first: timingSafeEqual throws on a mismatch, and a length is not
  // a secret worth hiding.
  if (presented.length !== expected.length) return null;
  if (!timingSafeEqual(presented, expected)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const { t, p, d, e } = parsed as Record<string, unknown>;
  if (typeof t !== "string" || t === "") return null;
  if (typeof p !== "string" || p === "") return null;
  if (!isLinkable(d)) return null;
  if (typeof e !== "number" || !Number.isFinite(e)) return null;
  if (e <= now) return null;

  return { tenantSlug: t, protocolNumber: p, documento: d, expiresAt: e };
}

/** The last path segment of the link: the file name the browser shows in the
 * tab and suggests on save. Decorative, the route reads nothing from it, but
 * it is what turns "requerimento" in the tab into the document's own name. */
export function pdfLinkFileName(
  documento: LinkableDocument,
  protocolNumber: string,
): string {
  return `${documento}-${protocolNumber}.pdf`;
}
