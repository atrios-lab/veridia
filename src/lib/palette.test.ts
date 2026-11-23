import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { NEUTRALS, PALETTES } from "../core/tenant/palette.ts";
import { THEMES } from "../core/tenant/schema.ts";

const stylesheet = readFileSync("src/app/brand-palettes.css", "utf8");

/** Reads one `--palette-<name>` declaration out of the stylesheet. */
function declared(name: string): string | undefined {
  return stylesheet.match(
    new RegExp(`--palette-${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`),
  )?.[1];
}

function kebab(token: string): string {
  return token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

test("every colour the PDF draws is the one the stylesheet declares", () => {
  for (const theme of THEMES) {
    for (const [token, value] of Object.entries(PALETTES[theme])) {
      const name = `${theme}-${kebab(token)}`;
      assert.equal(declared(name), value, `--palette-${name}`);
    }
  }
  for (const [token, value] of Object.entries(NEUTRALS)) {
    assert.equal(declared(kebab(token)), value, `--palette-${kebab(token)}`);
  }
});

test("no theme colour exists in the stylesheet without a mirror here", () => {
  // The direction the assertion above cannot catch: a token added to the
  // stylesheet and forgotten here would simply never be compared.
  for (const theme of THEMES) {
    const inCss = [
      ...stylesheet.matchAll(new RegExp(`--palette-${theme}-([\\w-]+):`, "g")),
    ].map((match) => match[1]);
    const mirrored = Object.keys(PALETTES[theme]).map(kebab);
    assert.deepEqual(inCss.toSorted(), mirrored.toSorted(), theme);
  }
});

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const c = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

test("every theme keeps its text pairs at 4.5:1 or more", () => {
  // The a11y sweep only reaches a theme some office already wears, so a theme
  // on offer that nobody picked yet would go unmeasured until the day it is
  // published. These are the text pairs the public site draws most; the
  // accent itself is left out, as it only ever marks large or decorative
  // elements and sits under 4.5:1 in every theme since the first five.
  for (const theme of THEMES) {
    const p = PALETTES[theme];
    const pairs: [string, string, string][] = [
      ["white on primary", NEUTRALS.card, p.primary],
      ["white on primary-soft", NEUTRALS.card, p.primarySoft],
      ["primary on surface", p.primary, p.surface],
      ["primary on tint", p.primary, p.tint],
      ["accent-ink on card", p.accentInk, NEUTRALS.card],
      ["accent-ink on surface", p.accentInk, p.surface],
      ["accent-ink on accent-soft", p.accentInk, p.accentSoft],
      ["accent-ink on tint", p.accentInk, p.tint],
      ["muted on surface", p.muted, p.surface],
      ["muted on tint", p.muted, p.tint],
      ["on-dark accent on primary", p.onDarkAccent, p.primary],
      ["on-dark heading on primary", p.onDarkHeading, p.primary],
      ["faint on surface", NEUTRALS.faint, p.surface],
    ];
    for (const [label, foreground, background] of pairs) {
      const ratio = contrast(foreground, background);
      assert.ok(ratio >= 4.5, `${theme}: ${label}: ${ratio.toFixed(2)}:1`);
    }
  }
});
