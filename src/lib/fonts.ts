import {
  Bitter,
  Cormorant_Garamond,
  Libre_Baskerville,
  Lora,
  Spectral,
} from "next/font/google";
import type { Theme } from "@/core/tenant/schema.ts";

// Every face declares the same variable, so exactly one of them reaches the
// tree at a time: the office's theme picks the className, and only that font
// is served. Written out one by one because next/font only accepts literal
// options.
//
// Shared between the public layout (one office, one theme, all the time) and
// the admin visual identity tab, which is the one screen in the panel that
// needs all five at once: it draws each style's name in its own serif and
// lets the registrar pick among them before anything is published.
//
// `preload: false` on every face: next/font preloads each font declared in
// a module the route imports, and it cannot know which theme the office
// uses, so every public page preloaded all five families (7 files, ~170 KB)
// for the one it draws. On a phone those high-priority downloads competed
// with the hero photo and held the LCP near 3 s (PageSpeed, 16/11/2026).
// The face in use still loads as soon as the stylesheet asks for it, with
// `swap` showing the fallback meanwhile.
const spectral = Spectral({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-brand-serif",
  display: "swap",
  preload: false,
});
const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-brand-serif",
  display: "swap",
  preload: false,
});
const lora = Lora({
  subsets: ["latin"],
  variable: "--font-brand-serif",
  display: "swap",
  preload: false,
});
const bitter = Bitter({
  subsets: ["latin"],
  variable: "--font-brand-serif",
  display: "swap",
  preload: false,
});
const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-brand-serif",
  display: "swap",
  preload: false,
});

export const SERIF: Record<Theme, { variable: string; className: string }> = {
  "verde-dourado": spectral,
  "marinho-bronze": libreBaskerville,
  "vinho-perola": lora,
  "grafite-cobre": bitter,
  "oliva-terracota": cormorantGaramond,
};
