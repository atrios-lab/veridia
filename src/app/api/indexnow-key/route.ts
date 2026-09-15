import { NextResponse } from "next/server";
import { INDEXNOW_KEY } from "@/lib/indexnow.ts";
import { getTenant } from "@/lib/tenant.ts";

/**
 * The verification file IndexNow fetches back from each office's own host
 * before accepting a submission carrying that host, rewritten here from the
 * literal "/<key>.txt" the protocol requires (see the `rewrites()` entry in
 * next.config.ts). Not implemented as a route handler directly under a
 * folder named "<key>.txt": that shape rendered the app's own 404 in the
 * production build, App Router or Turbopack apparently not registering a
 * route under a dotted, extension-like segment the way `next dev` does.
 * The rewrite keeps the external URL exactly as IndexNow expects while
 * this handler lives at an ordinary path.
 *
 * Content is the key itself, nothing else:
 * https://www.indexnow.org/documentation.
 */
export async function GET() {
  // Resolved for the refusal only, like every other route here: an
  // unregistered host gets the same 404 as everywhere else instead of a
  // definite-looking answer, even though the key itself does not vary by
  // tenant.
  await getTenant();
  return new NextResponse(INDEXNOW_KEY, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
