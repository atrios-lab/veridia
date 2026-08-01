// Forbids the em dash and the en dash in source that reaches the user.
// Both render as a stray horizontal line in the product's typography and the
// team never types them on purpose; they arrive by autocorrect and by paste.
import { globSync, readFileSync } from "node:fs";

const FORBIDDEN = { "—": "travessão", "–": "meia-risca" };
const PATTERNS = ["src/**/*.{ts,tsx,css}", "e2e/**/*.ts"];

const failures = [];

for (const file of PATTERNS.flatMap((p) => globSync(p))) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, index) => {
      for (const [char, name] of Object.entries(FORBIDDEN)) {
        const column = line.indexOf(char);
        if (column >= 0) {
          failures.push(`${file}:${index + 1}:${column + 1} ${name} (${char})`);
        }
      }
    });
}

if (failures.length > 0) {
  console.error("Travessão ou meia-risca em texto visível:");
  for (const failure of failures) console.error(`  ${failure}`);
  console.error("\nUse vírgula, dois-pontos ou parênteses.");
  process.exit(1);
}

console.log("check:dashes ok");
