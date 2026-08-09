import type { Theme } from "./schema.ts";

/**
 * The same colours as the `@theme` block of `src/app/globals.css`, in
 * TypeScript, because the PDF documents are drawn by PDFKit and PDFKit does
 * not read CSS. The stylesheet stays the reference: `palette.test.ts` parses
 * it and fails if these two ever disagree.
 *
 * This is the only module outside the stylesheet allowed to write a colour
 * down (see `scripts/check-tokens.mjs`), and it exists for one consumer:
 * `src/lib/pdf.ts`.
 */
export interface Palette {
  primary: string;
  primarySoft: string;
  shade: string;
  accent: string;
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
    accentSoft: "#f2e3d6",
    onDarkAccent: "#dcc59a",
    onDarkHeading: "#ead9ac",
    surface: "#f6f3ea",
    border: "#e2ddcc",
    tint: "#ebeee2",
    muted: "#6a6d58",
  },
};

/** Neutrals identical in every theme. */
export const NEUTRALS = {
  card: "#ffffff",
  text: "#1c211e",
  textSoft: "#3d453f",
  faint: "#8b9289",
  alert: "#a4402f",
} as const;

export function paletteFor(theme: Theme): Palette {
  return PALETTES[theme];
}
