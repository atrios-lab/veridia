import "server-only";
import { globalConfigAdapter } from "@flags-sdk/global-config";
import { flag } from "flags/next";
import { SECTION_ROUTES } from "@/core/tenant/gating.ts";

const LOOKUP_ROUTE = SECTION_ROUTES["consulta-protocolo"];

/**
 * Which route the site recommends for following a protocol: the new
 * /acompanhar (progress rail, chat, Pix) or the current /protocolo. Read
 * from the project's Edge Config on Vercel, so it flips without a deploy,
 * and overridable per session from the Vercel Toolbar. Both pages stay
 * reachable by URL whatever the value: this only decides the links.
 * See openspec/changes/feature-flag-acompanhar.
 */
export const citizenTrackingV2 = flag<boolean>({
  key: "citizen-tracking-v2",
  description:
    "Consulta do cidadão pelo /acompanhar (trilho) em vez de /protocolo. " +
    "Ver openspec/changes/feature-flag-acompanhar.",
  defaultValue: false,
  // Local and CI have no Edge Config, and the adapter factory refuses to
  // build without one: there the flag decides "off" on its own, no
  // variable required. With a store configured, any failed read (store
  // down, item missing) lands on defaultValue: the SDK catches it.
  ...(process.env.EDGE_CONFIG
    ? { adapter: globalConfigAdapter }
    : { decide: () => false }),
});

/**
 * The one place that turns the flag into an address. Every link the site
 * itself draws to the lookup (header, footer, home, chat) reads this;
 * nothing else may read the flag. The catch covers what the SDK does not:
 * an override cookie it cannot decrypt (a stale one from another
 * environment, say) throws before defaultValue applies, and a broken
 * cookie must not take the page down.
 */
export async function trackingHref(): Promise<string> {
  try {
    return (await citizenTrackingV2()) ? "/acompanhar" : LOOKUP_ROUTE;
  } catch {
    return LOOKUP_ROUTE;
  }
}
