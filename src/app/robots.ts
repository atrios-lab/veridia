import type { MetadataRoute } from "next";
import { ROBOTS_DISALLOW } from "@/core/tenant/site.ts";
import { getSiteOrigin } from "@/lib/site-origin.ts";
import { getTenant } from "@/lib/tenant.ts";

// Served at /robots.txt. Per request, not at build time: the sitemap it
// points to is on the office's own domain, and one deploy serves them all.
export default async function robots(): Promise<MetadataRoute.Robots> {
  // Resolved for the refusal only: an unregistered host gets the same 404
  // here as on every page, never a robots.txt naming another office's site.
  await getTenant();
  const origin = await getSiteOrigin();
  return {
    // One rule for every crawler, AI fetchers included: a public office's
    // site gains from being cited, and blocking training crawlers is a
    // decision to take per office, not a default to ship silently.
    rules: [{ userAgent: "*", allow: "/", disallow: [...ROBOTS_DISALLOW] }],
    sitemap: `${origin}/sitemap.xml`,
  };
}
