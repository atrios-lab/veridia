import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { siteOrigin } from "@/core/tenant/site.ts";
import { requestHost } from "./request-host.ts";

/**
 * The origin of the current request, for the canonical URL, robots.txt and
 * the sitemap. Server only, like `getTenant`, and read the same way: the
 * host the browser asked for, forwarded header first.
 *
 * Never reached without a host: `getTenant` refuses a request with none
 * (or with an unregistered one) before any of the callers here render, so
 * the fallback below is for the type, not for a case that happens.
 *
 * On a Vercel preview URL this names the preview host, which is correct:
 * Vercel already answers those with `X-Robots-Tag: noindex`, and a canonical
 * pointing at production from a preview would just be a lie about which
 * page this is.
 */
export const getSiteOrigin = cache(async (): Promise<string> => {
  const host = requestHost(await headers()) ?? "localhost";
  return siteOrigin(host);
});
