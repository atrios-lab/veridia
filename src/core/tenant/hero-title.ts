import type { Theme } from "./schema.ts";

/**
 * How big the office's name is drawn on the home page, from md up
 * (decision of 23/11/2026: "todos que for grande que seja harmonizado").
 * A short or middling name sits on one line, the letters a little smaller
 * when it is long; a name too long for one line sits on two balanced
 * lines (three, for the longest names in the widest fonts). Each theme has its own serif, and they are not equally wide, so
 * the size comes from how wide that font draws a capital letter.
 */

/**
 * Width of one capital letter, in em, of each theme's serif at the hero's
 * weight: the widest of the offices' titles, measured in the browser on
 * 23/11/2026, plus a small margin. A theme added without a measure falls
 * back to the widest of them.
 */
export const CAPITAL_EM: Record<Theme, number> = {
  "verde-dourado": 0.64, // Spectral
  "marinho-bronze": 0.73, // Libre Baskerville
  "vinho-perola": 0.62, // Lora
  "grafite-cobre": 0.58, // Bitter
  "oliva-terracota": 0.58, // Cormorant Garamond
  "petroleo-ouro": 0.62, // Merriweather
  "ameixa-champanhe": 0.6, // Playfair Display
  "cafe-caramelo": 0.53, // Crimson Pro
  "indigo-areia": 0.63, // Literata
  "azul-prata": 0.6, // Source Serif 4
};
const WIDEST_EM = Math.max(...Object.values(CAPITAL_EM));

/** The room the title has on a wide screen, in rem (the CSS uses it too). */
export const TITLE_ROOM_REM = 60;
/** Below this, one line would look too small: the name goes to two. */
const ONE_LINE_MIN_REM = 2.125;
const ONE_LINE_MAX_REM = 3;
const TWO_LINES_MAX_REM = 2.5;
const THREE_LINES_MAX_REM = 2.25;
/** Below this, two lines would look too small: the name goes to three. */
export const SMALLEST_WIDE_REM = 2;
/** Lines never split exactly even: words break where they can. */
const UNEVEN_BREAK = 1.12;

export interface HeroTitleFit {
  lines: 1 | 2 | 3;
  /** The width of the title at 1rem: the font size is the room over it. */
  ems: number;
  /** The largest size, in rem, however much room there is. */
  maxRem: number;
  /**
   * The size on a phone: a name that needs two lines on a wide screen
   * would take four on a phone, so it gets slightly smaller letters there.
   */
  phoneSize: string;
}

const PHONE_SIZE = "clamp(1.25rem, 6.8vw, 1.75rem)";
const PHONE_SIZE_LONG = "clamp(1.125rem, 5.6vw, 1.5rem)";

export function heroTitleFit(title: string, theme: Theme): HeroTitleFit {
  const capital = CAPITAL_EM[theme] ?? WIDEST_EM;
  const oneLine = Math.max(1, [...title.trim()].length) * capital;
  if (TITLE_ROOM_REM / oneLine >= ONE_LINE_MIN_REM) {
    return {
      lines: 1,
      ems: round(oneLine),
      maxRem: ONE_LINE_MAX_REM,
      phoneSize: PHONE_SIZE,
    };
  }
  const twoLines = (oneLine / 2) * UNEVEN_BREAK;
  if (TITLE_ROOM_REM / twoLines >= SMALLEST_WIDE_REM) {
    return {
      lines: 2,
      ems: round(twoLines),
      maxRem: TWO_LINES_MAX_REM,
      phoneSize: PHONE_SIZE_LONG,
    };
  }
  return {
    lines: 3,
    ems: round((oneLine / 3) * UNEVEN_BREAK * 1.05),
    maxRem: THREE_LINES_MAX_REM,
    phoneSize: PHONE_SIZE_LONG,
  };
}

const round = (value: number) => Math.round(value * 100) / 100;

/** The size the title gets on a wide screen, in rem, for the tests. */
export function wideTitleRem(fit: HeroTitleFit): number {
  return Math.min(fit.maxRem, TITLE_ROOM_REM / fit.ems);
}
