import "server-only";
import { vercelAdapter } from "@flags-sdk/vercel";
import { flag } from "flags/next";
import { SECTION_ROUTES } from "@/core/tenant/gating.ts";

const LOOKUP_ROUTE = SECTION_ROUTES["consulta-protocolo"];

/**
 * Which route the site recommends for following a protocol: the new
 * /acompanhar (progress rail, chat, Pix) or the current /protocolo. Read
 * from Vercel Flags (managed in the project's dashboard), so it flips
 * without a deploy, and overridable per session from the Vercel Toolbar.
 * Both pages stay reachable by URL whatever the value: this only decides
 * the links. See openspec/changes/feature-flag-acompanhar and
 * migrar-para-vercel-flags.
 */
export const citizenTrackingV2 = flag<boolean>({
  key: "citizen-tracking-v2",
  description:
    "Consulta do cidadão pelo /acompanhar (trilho) em vez de /protocolo. " +
    "Ver openspec/changes/feature-flag-acompanhar.",
  defaultValue: false,
  adapter: vercelAdapter,
});

/**
 * The one place that turns the flag into an address. Every link the site
 * itself draws to the lookup (header, footer, home, chat) reads this;
 * nothing else may read the flag. The catch covers what the SDK does not:
 * an override cookie it cannot decrypt (a stale one from another
 * environment, say) throws before defaultValue applies, and a broken
 * cookie must not take the page down.
 *
 * The optional `request` is never passed by a Server Component (there is no
 * `Request` object to give it; the SDK reads the override cookie off Next's
 * own request context instead), only by a test, which builds one carrying a
 * `Cookie` header the way `flags`' own `flag(req)` form expects.
 */
export async function trackingHref(request?: Request): Promise<string> {
  try {
    const on = request
      ? await citizenTrackingV2(request)
      : await citizenTrackingV2();
    return on ? "/acompanhar" : LOOKUP_ROUTE;
  } catch {
    return LOOKUP_ROUTE;
  }
}
