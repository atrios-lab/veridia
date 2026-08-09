import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { NEUTRALS, PALETTES } from "../core/tenant/palette.ts";
import { THEMES } from "../core/tenant/schema.ts";

const stylesheet = readFileSync("src/app/globals.css", "utf8");

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
