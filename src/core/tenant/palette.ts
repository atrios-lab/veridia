import type { Theme } from "./schema.ts";

/**
 * The same colours as the `@theme` block of `src/app/brand-palettes.css`, in
 * TypeScript, because the PDF documents are drawn by PDFKit and PDFKit does
 * not read CSS. The stylesheet stays the reference: `palette.test.ts` parses
 * it and fails if these two ever disagree.
 *
 * This is the only module outside the stylesheet allowed to write a colour
 * down (see `scripts/check-tokens.mjs`). Its consumers are the two renderers
 * that cannot read a stylesheet: `src/lib/pdf.ts`, which draws the documents,
 * and `src/lib/email/render.ts`, which writes inline styles into an e-mail.
 */
export interface Palette {
  primary: string;
  primarySoft: string;
  shade: string;
  accent: string;
  accentInk: string;
  accentSoft: string;
  onDarkAccent: string;
  onDarkHeading: string;
  surface: string;
  border: string;
  tint: string;
  muted: string;
}

export const PALETTES: Record<Theme, Palette> = {
  "verde-dourado": {
    primary: "#123c2a",
    primarySoft: "#1c5638",
    shade: "#091e14",
    accent: "#8f7238",
    accentInk: "#7f6532",
    accentSoft: "#efe8d6",
    onDarkAccent: "#d9c89a",
    onDarkHeading: "#e8d9ae",
    surface: "#f4f3ee",
    border: "#e3dfd4",
    tint: "#e9efea",
    muted: "#59635b",
  },
  "marinho-bronze": {
    primary: "#16324f",
    primarySoft: "#1f4468",
    shade: "#0a1a2a",
    accent: "#9c7c46",
    accentInk: "#7c6338",
    accentSoft: "#efe6d2",
    onDarkAccent: "#d5bd8a",
    onDarkHeading: "#e3d3a8",
    surface: "#f3f4f1",
    border: "#dfe0d8",
    tint: "#e7ecf1",
    muted: "#5c6470",
  },
  "vinho-perola": {
    primary: "#55202c",
    primarySoft: "#6e2c3a",
    shade: "#2b0e14",
    accent: "#a1734b",
    accentInk: "#855f3e",
    accentSoft: "#f0e4d8",
    onDarkAccent: "#dcc296",
    onDarkHeading: "#ecd9b8",
    surface: "#f6f2ee",
    border: "#e6dcd4",
    tint: "#f1e7e4",
    muted: "#6e625c",
  },
  "grafite-cobre": {
    primary: "#26302d",
    primarySoft: "#37443f",
    shade: "#141917",
    accent: "#b0703c",
    accentInk: "#8e5a30",
    accentSoft: "#f0e3d5",
    onDarkAccent: "#dcba88",
    onDarkHeading: "#e6c9a6",
    surface: "#f2f1ec",
    border: "#dedcd3",
    tint: "#e9eae6",
    muted: "#646a64",
  },
  "oliva-terracota": {
    primary: "#3f4f2e",
    primarySoft: "#55663f",
    shade: "#1f2814",
    accent: "#b3552e",
    accentInk: "#a34d2a",
    accentSoft: "#f2e3d6",
    onDarkAccent: "#dcc59a",
    onDarkHeading: "#ead9ac",
    surface: "#f6f3ea",
    border: "#e2ddcc",
    tint: "#ebeee2",
    muted: "#6a6d58",
  },
  "petroleo-ouro": {
    primary: "#0f3d44",
    primarySoft: "#175560",
    shade: "#071e22",
    accent: "#957434",
    accentInk: "#7c6130",
    accentSoft: "#efe7d3",
    onDarkAccent: "#dcc68f",
    onDarkHeading: "#ead8a8",
    surface: "#f2f4f2",
    border: "#dde2dd",
    tint: "#e5eeee",
    muted: "#57656a",
  },
  "ameixa-champanhe": {
    primary: "#3d2347",
    primarySoft: "#553160",
    shade: "#1e1023",
    accent: "#9a7a50",
    accentInk: "#7e633f",
    accentSoft: "#efe6d8",
    onDarkAccent: "#dcc39c",
    onDarkHeading: "#ecdbbe",
    surface: "#f5f2f1",
    border: "#e3dcdc",
    tint: "#eee8ee",
    muted: "#665d68",
  },
  "cafe-caramelo": {
    primary: "#3a2a20",
    primarySoft: "#523b2d",
    shade: "#1d140f",
    accent: "#a5702f",
    accentInk: "#87592a",
    accentSoft: "#f1e4d3",
    onDarkAccent: "#e0bf8c",
    onDarkHeading: "#edd6ad",
    surface: "#f6f2ec",
    border: "#e5ddd1",
    tint: "#efe9e1",
    muted: "#6a5f55",
  },
  "indigo-areia": {
    primary: "#2b2f63",
    primarySoft: "#3b417e",
    shade: "#14162f",
    accent: "#9a7b4f",
    accentInk: "#7b623e",
    accentSoft: "#efe6d6",
    onDarkAccent: "#d9c39b",
    onDarkHeading: "#e8d8b6",
    surface: "#f3f3f2",
    border: "#dedfe0",
    tint: "#e8e9f2",
    muted: "#5d6072",
  },
  "azul-prata": {
    primary: "#1c3f7a",
    primarySoft: "#27509a",
    shade: "#0d1f3d",
    accent: "#66748a",
    accentInk: "#556275",
    accentSoft: "#e6eaf0",
    onDarkAccent: "#c8d2e0",
    onDarkHeading: "#dde4ee",
    surface: "#f3f5f8",
    border: "#dce1e8",
    tint: "#e6ecf5",
    muted: "#586274",
  },
};

/** Neutrals identical in every theme. */
export const NEUTRALS = {
  card: "#ffffff",
  text: "#1c211e",
  textSoft: "#3d453f",
  faint: "#61675f",
  alert: "#a4402f",
} as const;

export function paletteFor(theme: Theme): Palette {
  return PALETTES[theme];
}

/**
 * The outgoing e-mail's own palette. Fixed and institutional, deliberately
 * not one of the themes above: an e-mail client cannot read a CSS
 * variable, so every colour is inlined into the markup, and threading every
 * tenant palette through that is work no recipient would notice.
 *
 * It lives here rather than beside the renderer for one reason: this module is
 * where a colour is allowed to be written down, and the invariant is worth
 * more than the proximity.
 */
export const EMAIL_PALETTE = {
  background: "#f7f5ef",
  card: "#ffffff",
  border: "#e3dfd4",
  primary: "#123c2a",
  muted: "#8f9a90",
  text: "#1c211e",
  button: "#1c5638",
} as const;

/**
 * The Átrios brand as its own site wears it (site-atrios): near black, the
 * two blues of its buttons and highlights, and the greys of its light pages.
 * The course certificate is issued by Átrios to every office alike, so it
 * wears this and no office's palette. Kept here for the same reason as the
 * e-mail palette: this module is where a colour may be written down.
 */
export const ATRIOS_BRAND = {
  ink: "#0b0f17",
  grey: "#4b5563",
  rule: "#d6dce8",
  ruleSoft: "#e6eaf1",
  signatureLine: "#9aa3b2",
  blue: "#2563eb",
  blueDeep: "#1d4ed8",
  blueLight: "#60a5fa",
  blueGlow: "#3b82f6",
  blueTint: "#eaf1ff",
  band: "#07080b",
  white: "#ffffff",
  alert: "#b42318",
} as const;

/**
 * The tabela de custas in the office's standard (decision of 22/11/2026):
 * the navy of the mark, black text, grey rules and the light shades of the
 * header row, the captions and the watermark, as the table has them.
 */
export const FEE_TABLE_PALETTE = {
  navy: "#1f2a5c",
  ink: "#111111",
  muted: "#555555",
  line: "#222222",
  shade: "#eef0f4",
  groupShade: "#f6f7f9",
  rule: "#999999",
  watermark: "#8a8fa3",
} as const;
