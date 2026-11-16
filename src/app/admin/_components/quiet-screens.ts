// Screens where the office's floating alerts (agenda, guias, new requests,
// LGPD, ouvidoria, chat) stay off. The cohorts screens are the Átrios
// platform's work, not the office's: in the demonstration office the
// participants keep its desk busy, and the alerts covered the cohort list
// and its forms (decision of 16/11/2026).
export const QUIET_SCREENS = ["/admin/ajuda/gerenciar/turmas"] as const;

/** Whether this panel address is one of the quiet screens or inside one. */
export function isQuietScreen(pathname: string): boolean {
  return QUIET_SCREENS.some(
    (screen) => pathname === screen || pathname.startsWith(`${screen}/`),
  );
}
