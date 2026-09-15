import { NextResponse } from "next/server";
import { INDEXNOW_KEY } from "@/lib/indexnow.ts";
import { getTenant } from "@/lib/tenant.ts";

// The verification file IndexNow fetches back from each office's own host
// before accepting a submission carrying that host. Content is the key
// itself, nothing else: https://www.indexnow.org/documentation. The key does
// not vary by tenant, but the same host check every other route here does
// still applies: resolved for the refusal only, so an unregistered host
// gets the same 404 as everywhere else instead of a definite-looking answer.
export async function GET() {
  await getTenant();
  return new NextResponse(INDEXNOW_KEY, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
