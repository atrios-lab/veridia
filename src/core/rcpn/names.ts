/**
 * Names compared the way a person types them: without accents, capitals,
 * repeated spaces or the particles in the middle ("de", "da", "dos").
 * The public lookup matches these exactly (design, decision 6); only the
 * panel tolerates spelling.
 */

const PARTICLES = new Set(["DE", "DA", "DO", "DAS", "DOS", "E", "D"]);

export function nameTokens(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]+/g, " ")
    .split(" ")
    .filter((token) => token.length > 0 && !PARTICLES.has(token));
}

export function normalizeName(name: string): string {
  return nameTokens(name).join(" ");
}

/** Edits between two short words, stopping early past `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
      current.push(value);
      best = Math.min(best, value);
    }
    if (best > max) return max + 1;
    previous = current;
  }
  return previous[b.length] ?? max + 1;
}

function tokenMatches(
  wanted: string,
  candidates: string[],
): "exact" | "near" | null {
  if (candidates.includes(wanted)) return "exact";
  const tolerance = wanted.length >= 7 ? 2 : wanted.length >= 4 ? 1 : 0;
  if (tolerance === 0) return null;
  return candidates.some((c) => distance(wanted, c, tolerance) <= tolerance)
    ? "near"
    : null;
}

/**
 * How a typed name fits a registered one, for the panel: "exact" when
 * every typed word is in the name, "near" when every typed word is in it
 * or one or two letters off, null otherwise. Order does not matter: a
 * clerk types the surname first as often as not.
 */
export function nameFit(
  typed: string,
  registered: string,
): "exact" | "near" | null {
  const wanted = nameTokens(typed);
  if (wanted.length === 0) return null;
  const have = nameTokens(registered);
  let near = false;
  for (const token of wanted) {
    const fit = tokenMatches(token, have);
    if (!fit) return null;
    if (fit === "near") near = true;
  }
  return near ? "near" : "exact";
}
