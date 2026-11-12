import type { Metadata } from "next";
import type { Tenant } from "@/core/tenant/schema.ts";
import { PAGE_META, siteTitle, socialMetadata } from "@/core/tenant/seo.ts";

/**
 * The metadata every route inherits: the office's title and seal, the
 * canonical and the social card. The site and the panel each have their own
 * root layout (they load different stylesheets and fonts), and both start
 * from this, so a route reads the same `<head>` under either.
 */
export function rootMetadata(tenant: Tenant, origin: string): Metadata {
  return {
    // The canonical of every route is its own path on the office's domain,
    // query string dropped: "./" is resolved by Next against the pathname
    // of the request being rendered, not against this layout's "/", so a
    // page need not repeat it. Without it, "/?utm_source=x" and
    // "/acompanhar?numero=..." each count as a page of their own to a
    // search engine, and it picks which one to show.
    metadataBase: new URL(origin),
    alternates: { canonical: "./" },
    // The home's title carries the kind of serventia and the town (see
    // siteTitle); the other pages keep the short name after their own.
    title: {
      default: siteTitle(tenant),
      template: `%s | ${tenant.name}`,
    },
    // The home's own description. Every public page overrides it through
    // publicMetadata; this is what any route without one falls back to.
    description: PAGE_META["/"].description(tenant),
    icons: { icon: tenant.logos.seal.light },
    // The card a shared link of the home shows. Every other public page
    // overrides this through publicMetadata with its own title, description
    // and image; /admin never needs it, since it is noindex and never
    // shared, so it is left with whatever this fallback declares.
    ...socialMetadata(
      tenant,
      siteTitle(tenant),
      PAGE_META["/"].description(tenant),
    ),
  };
}
