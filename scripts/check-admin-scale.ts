// Keeps one-off type sizes, radii, letter spacing and the serif out of the
// panel, against a baseline that may only go down. The rules and the reason
// for the baseline are in src/lib/admin-scale.ts.
//
//   pnpm check:admin-scale             fails if any file went over its count
//   pnpm check:admin-scale -- --update lowers the baseline to what is left
//
// --update never raises a count or adds a file. With no baseline file at
// all it records the current counts as the starting point: that only
// happens once, and deleting the file to reseed it shows up in review.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  type Baseline,
  compareWithBaseline,
  countOneOffs,
  isScannedFile,
  lowerBaseline,
} from "../src/lib/admin-scale.ts";

const BASELINE_FILE = "scripts/admin-scale-baseline.json";
const update = process.argv.includes("--update");

// readdirSync rather than globSync: the project's @types/node predates the
// latter, and this file is type-checked.
const ROOT = "src/app/admin";
const files = readdirSync(ROOT, { recursive: true, encoding: "utf8" })
  .map((entry) => `${ROOT}/${entry.split("\\").join("/")}`)
  .sort();

const counts: Record<string, number> = {};
for (const file of files) {
  if (!isScannedFile(file)) continue;
  const count = countOneOffs(readFileSync(file, "utf8"));
  if (count > 0) counts[file] = count;
}

const total = (baseline: Baseline) =>
  Object.values(baseline).reduce((sum, n) => sum + n, 0);
const write = (baseline: Baseline) =>
  writeFileSync(BASELINE_FILE, `${JSON.stringify(baseline, null, 2)}\n`);

if (!existsSync(BASELINE_FILE)) {
  if (!update) {
    console.error(`${BASELINE_FILE} não existe.`);
    process.exit(1);
  }
  write(counts);
  console.log(
    `Linha de base criada: ${total(counts)} valores avulsos em ${Object.keys(counts).length} arquivos.`,
  );
  process.exit(0);
}

const baseline: Baseline = JSON.parse(readFileSync(BASELINE_FILE, "utf8"));
const { failures, improved } = compareWithBaseline(counts, baseline);

if (update && improved.length > 0) {
  const next = lowerBaseline(counts, baseline);
  write(next);
  console.log(
    `Linha de base reduzida de ${total(baseline)} para ${total(next)} valores avulsos.`,
  );
}

if (failures.length > 0) {
  console.error(
    "Valor avulso de letra, raio, espaçamento ou serifada no painel:",
  );
  for (const { file, count, allowed } of failures) {
    console.error(`  ${file}: ${count} (o máximo é ${allowed})`);
  }
  console.error(
    "\nUse a escala do painel (text-xs a text-2xl, rounded-sm a rounded-xl, sem tracking-[ e sem font-serif).",
  );
  process.exit(1);
}

if (!update && improved.length > 0) {
  console.log(
    `${improved.length} arquivo(s) abaixo da linha de base. Rode pnpm check:admin-scale -- --update para baixá-la.`,
  );
}

console.log("check:admin-scale ok");
