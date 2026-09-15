import { enabledSections, sectionNavLinks } from "./gating.ts";
import type { Tenant } from "./schema.ts";

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

/**
 * Every public page the office offers, in navigation order: the enabled
 * sections (a section can open two pages, see `sectionNavLinks`) and the
 * institutional pages. Gated the same way the menus are, so the sitemap
 * never lists a page the office answers with 404.
 */
export function sitemapPaths(tenant: Tenant): string[] {
  const sectionPaths = enabledSections(tenant).flatMap((section) =>
    sectionNavLinks(section).map((link) => link.href),
  );
  return [...sectionPaths, ...INSTITUTIONAL_PATHS];
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
