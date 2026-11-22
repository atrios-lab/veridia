import type { MetadataRoute } from "next";
import { newsSitemapEntries, sitemapPaths } from "@/core/tenant/site.ts";
import { publicNewsList } from "@/lib/news.ts";
import { getSiteOrigin } from "@/lib/site-origin.ts";
import { publicTeam } from "@/lib/team.ts";
import { getTenant } from "@/lib/tenant.ts";

// Served at /sitemap.xml, per request: which pages exist depends on the
// office answering the host. The fixed pages carry no date worth declaring
// as `lastModified`, and no priorities either: every value would be a guess,
// and a guess the search engine is documented to ignore. The team page and
// the notice board are listed only once something is published on them,
// like the menus; each published post is listed too, with the day it went
// to the site, since it is the only page here whose text is the office's own.
// An individual edital or transparency document is reached from its listing
// page, which is here.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tenant = await getTenant();
  const [origin, team, news] = await Promise.all([
    getSiteOrigin(),
    publicTeam(tenant.slug),
    publicNewsList(tenant.slug),
  ]);
  const content = { hasTeam: team.groups.length > 0, hasNews: news.length > 0 };
  const pages = sitemapPaths(tenant, content).map((path) => ({
    // The home is the bare origin: "/" alone would resolve to "origin/",
    // and the canonical the layout declares for it is the origin.
    url: path === "/" ? origin : `${origin}${path}`,
  }));
  const posts = content.hasNews
    ? newsSitemapEntries(news).map(({ path, lastModified }) => ({
        url: `${origin}${path}`,
        ...(lastModified ? { lastModified } : {}),
      }))
    : [];
  return [...pages, ...posts];
}
