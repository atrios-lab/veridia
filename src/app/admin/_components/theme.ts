/**
 * The panel's light or dark theme, chosen with the sun and moon button in
 * the top bar (theme-toggle.tsx) and kept in a cookie, so the root layout
 * can render the page already in it, with no white flash before the dark.
 * Light when the cookie is absent. A plain module: the layout (server) and
 * the button (client) both import it.
 */
export const THEME_COOKIE = "painel_tema";
export const DARK = "escuro";
