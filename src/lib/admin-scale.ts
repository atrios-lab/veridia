// The panel's closed scales (type size, radius, letter spacing, sans only)
// and the ratchet that keeps them closed. See the change painel-neutro-shadcn.
//
// The panel starts with well over a thousand one-off values, so forbidding
// them outright would turn the check red on day one, and a check born red
// gets switched off. Instead each file has a recorded count that may only
// go down: a new file starts at zero, an old file can lose occurrences but
// never gain them. When the migration ends the baseline is empty and the
// rule is absolute.
//
// Pure on purpose: the script in scripts/check-admin-scale.ts does the file
// reading and writing, this module only counts and compares.

export type Baseline = Record<string, number>;

// A one-off value written straight into a class. `rounded-[` also catches
// the per-side forms (`rounded-t-[`, `rounded-tl-[`).
const ONE_OFF = [
  /\btext-\[/g,
  /\brounded(?:-[a-z]{1,2})?-\[/g,
  /\btracking-\[/g,
  /(?<![\w-])font-serif(?![\w-])/g,
];

// The screens that draw the public site inside the panel. They need the
// office's palette and serif, so the panel's scales do not apply to them.
export const EXEMPT: readonly string[] = [
  "src/app/admin/(dashboard)/configuracoes/identidade-visual/preview.tsx",
  "src/app/admin/(dashboard)/configuracoes/identidade-visual/visual-identity-form.tsx",
  "src/app/admin/(dashboard)/publicacoes/_components/preview.tsx",
];

export function isScannedFile(path: string): boolean {
  return (
    path.startsWith("src/app/admin/") &&
    /\.tsx?$/.test(path) &&
    !/\.test\.tsx?$/.test(path) &&
    !EXEMPT.includes(path)
  );
}

export function countOneOffs(source: string): number {
  let total = 0;
  for (const pattern of ONE_OFF) total += source.match(pattern)?.length ?? 0;
  return total;
}

export type Comparison = {
  // Files over their recorded count, or with any one-off and no record.
  failures: { file: string; count: number; allowed: number }[];
  // Files under their recorded count: the baseline can come down.
  improved: { file: string; count: number; allowed: number }[];
};

/**
 * Compares the current counts against the baseline. A file absent from
 * `counts` (deleted, renamed, or now clean and not scanned) counts as zero.
 */
export function compareWithBaseline(
  counts: Record<string, number>,
  baseline: Baseline,
): Comparison {
  const failures: Comparison["failures"] = [];
  const improved: Comparison["improved"] = [];
  const files = new Set([...Object.keys(counts), ...Object.keys(baseline)]);

  for (const file of [...files].sort()) {
    const count = counts[file] ?? 0;
    const allowed = baseline[file] ?? 0;
    if (count > allowed) failures.push({ file, count, allowed });
    else if (count < allowed) improved.push({ file, count, allowed });
  }
  return { failures, improved };
}

/**
 * The baseline after an update: every file keeps the lower of its recorded
 * and current counts, files that reached zero leave, and nothing is added
 * or raised. A file over its count stays at its old number, and the check
 * keeps failing until the extra occurrences go.
 */
export function lowerBaseline(
  counts: Record<string, number>,
  baseline: Baseline,
): Baseline {
  const next: Baseline = {};
  for (const file of Object.keys(baseline).sort()) {
    const lowered = Math.min(baseline[file], counts[file] ?? 0);
    if (lowered > 0) next[file] = lowered;
  }
  return next;
}
