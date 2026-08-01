// Forbids literal hex colours outside the theme token block.
//
// It exists before the design system does, on purpose: the day the first hex
// appears is the cheap day to catch it. Added later, it arrives with thirty
// to clean up and gets turned off instead.
import { globSync, readFileSync } from "node:fs";

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const PATTERNS = ["src/**/*.{ts,tsx,css}", "e2e/**/*.ts"];
// Font files declare their own family metadata and never carry colour.
const ALLOWED_FILES = /\/fonts?\//;

const failures = [];

for (const file of PATTERNS.flatMap((p) => globSync(p))) {
  if (ALLOWED_FILES.test(file)) continue;

  let insideTheme = false;
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, index) => {
      // Tokens live in the "@theme" block of the stylesheet. That block is
      // the one place a raw colour is allowed to be written down.
      if (/@theme\b/.test(line)) insideTheme = true;
      else if (insideTheme && line.trim() === "}") insideTheme = false;
      if (insideTheme) return;

      const match = line.match(HEX);
      if (match) failures.push(`${file}:${index + 1} ${match[0]}`);
    });
}

if (failures.length > 0) {
  console.error("Cor hexadecimal fora do bloco @theme:");
  for (const failure of failures) console.error(`  ${failure}`);
  console.error("\nDeclare um token no @theme e use a variável.");
  process.exit(1);
}

console.log("check:tokens ok");
