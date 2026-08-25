/**
 * The host the browser actually asked for.
 *
 * `host` alone is not it. After a Server Action calls `redirect()`, Next
 * re-renders the destination through a request of its own, and that request
 * carries the server's own address in `host` (`localhost:3000`), not the
 * office's domain: the real one moves to `x-forwarded-host`. Reading only
 * `host` there resolved every office to the `DEFAULT_TENANT` one, so the
 * first screen after signing in was another office's, and a plain reload
 * "fixed" it because a reload is an ordinary browser request again. Any
 * reverse proxy in front of the app (Vercel included) forwards the same way.
 *
 * Spoofable in principle, like every forwarded header, and harmless here:
 * it only ever selects among registered offices (an unknown host is refused
 * by `resolveTenant`), and what a panel user may do in the office it lands
 * on is decided separately by `canAccessTenant`, against their own account.
 */
export function requestHost(headers: Headers): string | undefined {
  return headers.get("x-forwarded-host") ?? headers.get("host") ?? undefined;
}
