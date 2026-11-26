/**
 * The panel's light or dark theme, chosen with the sun and moon button in
 * the top bar (theme-toggle.tsx) and kept in a cookie, so the root layout
 * can render the page already in it, with no white flash before the dark.
 * Light when the cookie is absent. A plain module: the layout (server) and
 * the button (client) both import it.
 */
export const THEME_COOKIE = "painel_tema";
export const DARK = "escuro";

/**
 * The background the office likes (decision of 26/11/2026): a tint and how
 * strong it is, over the light or the dark theme. Kept in a cookie as
 * "tint:intensity" so the page arrives already in it.
 */
export const BACKGROUND_COOKIE = "painel_fundo";

export const BACKGROUND_TINTS = {
  padrao: { label: "Padrão", color: "black" },
  azul: { label: "Azul", color: "rgb(30 58 138)" },
  verde: { label: "Verde", color: "rgb(20 83 45)" },
  sepia: { label: "Sépia", color: "rgb(120 53 15)" },
  vinho: { label: "Vinho", color: "rgb(127 29 29)" },
  cinza: { label: "Cinza", color: "rgb(75 85 99)" },
} as const;

export type BackgroundTint = keyof typeof BACKGROUND_TINTS;

export const MAX_INTENSITY = 40;

export function parseBackground(value: string | undefined): {
  tint: BackgroundTint;
  intensity: number;
} {
  const [tint, raw] = (value ?? "").split(":");
  const known = (tint ?? "") in BACKGROUND_TINTS;
  const intensity = Math.min(MAX_INTENSITY, Math.max(0, Number(raw) || 0));
  return {
    tint: known ? (tint as BackgroundTint) : "padrao",
    intensity: known ? intensity : 0,
  };
}

/** The CSS that tints the background, the surfaces and the muted areas. */
export function backgroundCss(tint: BackgroundTint, intensity: number): string {
  if (intensity <= 0) return "";
  const color = BACKGROUND_TINTS[tint].color;
  // The light theme writes its colours out (admin.css); the dark one
  // reads them from the palette.
  const LIGHT: Record<string, string> = {
    background: "rgb(255 255 255)",
    surface: "rgb(241 242 248)",
    muted: "rgb(245 245 245)",
    card: "rgb(255 255 255)",
    sidebar: "rgb(224 225 233)",
  };
  const mix = (mode: "light" | "dark", token: string, share: number) =>
    `--color-${token}: color-mix(in oklab, ${mode === "light" ? LIGHT[token] : `var(--palette-dark-${token})`} ${Math.round(100 - share)}%, ${color});`;
  const tokens = (mode: "light" | "dark") =>
    [
      mix(mode, "background", intensity),
      mix(mode, "surface", intensity),
      mix(mode, "muted", intensity * 0.8),
      mix(mode, "card", intensity * 0.5),
      mix(mode, "sidebar", intensity),
    ].join("");
  return `html{${tokens("light")}}html.dark{${tokens("dark")}}`;
}
