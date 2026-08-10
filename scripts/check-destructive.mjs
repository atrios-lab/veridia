// Forbids a row deletion that leaves no trail.
//
// Same bet as check-tokens.mjs, made on the same day it is cheap: today the
// data layer has exactly two DELETEs and both record audit, so this script
// starts green. Written a year from now it would arrive with a backlog and be
// switched off instead of fixed.
//
// The trail is what answers "who removed the citizen's document, and when".
// A DELETE is the one write that leaves nothing behind to reconstruct it
// from, so it is the one that cannot be allowed to skip recordAudit.
import { globSync, readFileSync } from "node:fs";

const PATTERNS = ["src/lib/**/*.ts", "src/app/**/actions.ts"];
const failures = [];

for (const file of PATTERNS.flatMap((p) => globSync(p))) {
  if (file.endsWith(".test.ts")) continue;

  const source = readFileSync(file, "utf8");
  if (!source.includes(".delete(")) continue;

  // Function bodies, split on the declaration keyword. Crude on purpose: a
  // deletion and its audit belong in the same function, and anything that
  // hides them from each other is already too clever for a delete path.
  const blocks = source.split(/\n(?=(?:export )?(?:async )?function )/);

  for (const block of blocks) {
    if (!block.includes(".delete(")) continue;
    if (block.includes("recordAudit(")) continue;

    const name = block.match(/function (\w+)/)?.[1] ?? "(anônima)";
    const line =
      source.slice(0, source.indexOf(block)).split("\n").length +
      block.slice(0, block.indexOf(".delete(")).split("\n").length -
      1;
    failures.push(`  ${file}:${line} ${name}`);
  }
}

if (failures.length > 0) {
  console.error("Remoção de linha sem registro em audit_log:");
  console.error(failures.join("\n"));
  console.error(
    "\nToda deleção chama recordAudit na mesma função. Sem o registro,\n" +
      "não há como responder quem removeu o documento do cidadão.",
  );
  process.exit(1);
}
