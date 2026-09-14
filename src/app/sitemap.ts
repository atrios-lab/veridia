import type { MetadataRoute } from "next";
import { sitemapPaths } from "@/core/tenant/site.ts";
import { getSiteOrigin } from "@/lib/site-origin.ts";
import { getTenant } from "@/lib/tenant.ts";

// Served at /sitemap.xml, per request: which pages exist depends on the
// office answering the host. Only the fixed pages are listed; an individual
// edital or transparency document is reached from its listing page, which
// is here, and carries no date worth declaring as `lastModified` for the
// page itself. No priorities either: every value would be a guess, and a
// guess the search engine is documented to ignore.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tenant = await getTenant();
  const origin = await getSiteOrigin();
  return sitemapPaths(tenant).map((path) => ({
    // The home is the bare origin: "/" alone would resolve to "origin/",
    // and the canonical the layout declares for it is the origin.
    url: path === "/" ? origin : `${origin}${path}`,
  }));
}
