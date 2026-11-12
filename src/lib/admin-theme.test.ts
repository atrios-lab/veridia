import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// The panel's theme is checked here rather than by eye: every text and
// background pair the panel draws must reach 4.5:1 (WCAG 1.4.3), and the
// edge of a control 3:1 (WCAG 1.4.11). Change a colour in admin.css and
// this says which pair broke and by how much.
const stylesheet = readFileSync("src/app/admin/admin.css", "utf8");

function token(name: string): string {
  const value = stylesheet.match(
    new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`),
  )?.[1];
  assert.ok(value, `--color-${name} is not declared as a hex in admin.css`);
  return value;
}

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

const TEXT: [foreground: string, backgrounds: string[]][] = [
  ["foreground", ["background", "card", "popover", "muted", "accent"]],
  ["muted-foreground", ["background", "card", "muted", "sidebar"]],
  ["primary", ["background", "muted", "sidebar"]],
  ["primary-foreground", ["primary"]],
  ["secondary-foreground", ["secondary"]],
  ["accent-foreground", ["accent"]],
  ["destructive", ["background", "destructive-soft"]],
  ["destructive-foreground", ["destructive"]],
  ["warning-foreground", ["warning"]],
  ["warning-text", ["background", "warning-soft"]],
  ["success-foreground", ["success"]],
  ["success-text", ["background", "success-soft"]],
  ["sidebar-foreground", ["sidebar", "sidebar-hover", "sidebar-accent"]],
  ["sidebar-accent-foreground", ["sidebar-accent"]],
  ["sidebar-label", ["sidebar"]],
  ["sidebar-primary-foreground", ["sidebar-primary"]],
];

test("every text colour of the panel reaches 4.5:1 on its backgrounds", () => {
  for (const [foreground, backgrounds] of TEXT) {
    for (const background of backgrounds) {
      const ratio = contrast(token(foreground), token(background));
      assert.ok(
        ratio >= 4.5,
        `${foreground} on ${background}: ${ratio.toFixed(2)}:1`,
      );
    }
  }
});

test("the edge of a field reaches 3:1 against the page", () => {
  for (const background of ["background", "card", "muted"]) {
    const ratio = contrast(token("input"), token(background));
    assert.ok(ratio >= 3, `input on ${background}: ${ratio.toFixed(2)}:1`);
  }
});
