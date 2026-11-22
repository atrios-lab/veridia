import { enabledSections, sectionNavLinks } from "./gating.ts";
import type { Section, Tenant } from "./schema.ts";

/**
 * The origin the site is served from, built from the host the browser
 * asked for: the canonical URL, robots.txt and the sitemap all name it.
 *
 * The request host, not `tenant.hosts[0]`: the config lists the bare domain,
 * but which spelling is the real one is decided at the edge, per domain,
 * and it is not the same for every office (most redirect the apex to "www",
 * a few serve the apex itself and have no "www" record at all). Whatever
 * the edge redirects to is the only host the app ever sees, so it is the
 * one to declare. Only development hosts are plain http.
 */
export function siteOrigin(host: string): string {
  const name = host.toLowerCase().split(":")[0];
  const local =
    name === "localhost" || name === "127.0.0.1" || name.endsWith(".localhost");
  return `${local ? "http" : "https"}://${host.toLowerCase()}`;
}

// Institutional pages every office publishes, linked from the footer and not
// gated by any section, so `enabledSections` does not know them.
const INSTITUTIONAL_PATHS = ["/plataforma", "/privacidade"] as const;

/** What the office has put on its team page and its notice board. */
export interface PublishedContent {
  hasTeam: boolean;
  hasNews: boolean;
}

/**
 * The sections the site links to: the enabled ones, minus the team page
 * while nobody is published on it and the notice board while it has no
 * post. An empty "Nossa equipe" is not worth a link, and the menus and the
 * sitemap both go by this one rule, so the sitemap never lists a page no
 * link reaches (the search engine files those as discovered and leaves them
 * there).
 */
export function linkedSections(
  tenant: Tenant,
  content: PublishedContent,
): Section[] {
  return enabledSections(tenant)
    .filter((section) => section !== "equipe" || content.hasTeam)
    .filter((section) => section !== "noticias" || content.hasNews);
}

/**
 * Every public page the office links to, in navigation order: the linked
 * sections (a section can open two pages, see `sectionNavLinks`) and the
 * institutional pages. Gated the same way the menus are, so the sitemap
 * never lists a page the office answers with 404 or leaves empty.
 */
export function sitemapPaths(
  tenant: Tenant,
  content: PublishedContent,
): string[] {
  const sectionPaths = linkedSections(tenant, content).flatMap((section) =>
    sectionNavLinks(section).map((link) => link.href),
  );
  return [...sectionPaths, ...INSTITUTIONAL_PATHS];
}

/**
 * One sitemap entry per published post, by the address its card links to.
 * `lastModified` is the day the post went to the site, the one date that is
 * really the page's; a post without it is listed with no date rather than a
 * made-up one.
 */
export function newsSitemapEntries(
  posts: readonly { id: string; publishedAt: string | null }[],
): { path: string; lastModified?: string }[] {
  return posts.map((post) => {
    const day = post.publishedAt?.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(day ?? "")
      ? { path: `/noticias/${post.id}`, lastModified: day }
      : { path: `/noticias/${post.id}` };
  });
}

/**
 * What no search engine should crawl. The panel and the API are not pages;
 * the rest only make sense with a token or a protocol number in the query.
 * "/acompanhar?numero=..." is deliberately not here: a URL robots.txt hides
 * can still be indexed from a link to it, title-less, because the crawler
 * never gets to read its noindex. Those variants carry a noindex in the
 * page instead (see acompanhar/page.tsx), which needs the crawl to work.
 */
export const ROBOTS_DISALLOW: readonly string[] = [
  "/admin",
  "/api",
  "/protocolo",
  "/agendar/cancelar",
  "/solicitar/requerimento",
];
