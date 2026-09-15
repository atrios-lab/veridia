import { NextResponse } from "next/server";
import { getSiteOrigin } from "@/lib/site-origin.ts";
import { getTenant } from "@/lib/tenant.ts";

/**
 * "/favicon.ico" itself, which some browsers and crawlers still request
 * regardless of the `<link rel="icon">` the layout already declares (see
 * `src/app/layout.tsx`), and which answered 404 before this route existed.
 *
 * A redirect, not a file: the office's seal is picked at request time by
 * host (see `getTenant`), the same way every other per-office asset here
 * is, and there is no single ".ico" that could be right for all eight.
 * Every browser and crawler that asks for a favicon follows a redirect.
 *
 * The target is built from `getSiteOrigin()`, not the incoming request's
 * own URL: that URL's host is the raw connection Next accepted, not
 * necessarily the domain a citizen typed (see `requestHost()`'s own
 * comment on the Host vs. X-Forwarded-Host split behind a proxy), and
 * `getSiteOrigin()` is the one place that distinction is already resolved.
 *
 * 307, not 301: the office can repaint its seal from the panel, and a
 * browser that cached this as permanent would keep showing the old one.
 */
export async function GET() {
  const tenant = await getTenant();
  const origin = await getSiteOrigin();
  return NextResponse.redirect(new URL(tenant.logos.seal.light, origin), 307);
}
