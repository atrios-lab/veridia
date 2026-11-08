import type { DocumentCategory } from "./documents.ts";

/**
 * How the public transparency page lays out what the office published:
 * bulletins by year in a fixed month grid, documents by category with the
 * current table up front. Pure: it takes rows already read and in the order
 * the database gave them, so the page stays a thin renderer and the rules
 * here are the ones the tests pin down.
 */

/** One year of bulletins: twelve slots, January first, `null` where none was published. */
export interface BulletinYear<T> {
  year: number;
  count: number;
  months: (T | null)[];
}

/**
 * Bulletins grouped by reference year, newest year first. The grid is always
 * twelve slots long, so a month keeps its place whether or not its neighbours
 * were published: a gap shows as a gap instead of closing up.
 */
export function groupBulletinsByYear<T extends { referenceMonth: string }>(
  rows: readonly T[],
): BulletinYear<T>[] {
  const byYear = new Map<number, BulletinYear<T>>();
  for (const row of rows) {
    const [year, month] = row.referenceMonth.split("-").map(Number);
    if (!Number.isInteger(year) || !(month >= 1 && month <= 12)) continue;
    let group = byYear.get(year);
    if (!group) {
      group = { year, count: 0, months: Array(12).fill(null) };
      byYear.set(year, group);
    }
    // One bulletin per month is the table's own rule; should two ever share
    // a month, the first one read (the order the caller chose) keeps the slot.
    if (group.months[month - 1] === null) {
      group.months[month - 1] = row;
      group.count += 1;
    }
  }
  return [...byYear.values()].sort((a, b) => b.year - a.year);
}

/**
 * The categories whose documents are editions of one another: a new year's
 * fee table replaces last year's. Only these put the first one up front and
 * fold the rest under "previous versions"; two notices are two different
 * documents, not two versions of one.
 */
export const VERSIONED_DOCUMENT_CATEGORIES: readonly DocumentCategory[] = [
  "Tabela de emolumentos",
  "Tabela de custas",
];

export interface DocumentGroup<T> {
  category: string;
  /** Shown up front: the current edition of a table, or every document of any other category. */
  current: T[];
  /** Older editions of a table, folded away. Always empty for unversioned categories. */
  previous: T[];
}

/**
 * Documents grouped by category. Groups come in the order each category
 * first appears in the rows, and the rows are expected in panel order, so the
 * operator's arrows still decide what comes first, on the page as in the
 * panel. A category outside the fixed list (only old data could hold one)
 * becomes a group of its own rather than disappearing.
 */
export function groupDocumentsByCategory<T extends { category: string }>(
  rows: readonly T[],
): DocumentGroup<T>[] {
  const groups = new Map<string, DocumentGroup<T>>();
  for (const row of rows) {
    let group = groups.get(row.category);
    if (!group) {
      group = { category: row.category, current: [], previous: [] };
      groups.set(row.category, group);
    }
    const versioned = (
      VERSIONED_DOCUMENT_CATEGORIES as readonly string[]
    ).includes(row.category);
    if (versioned && group.current.length > 0) group.previous.push(row);
    else group.current.push(row);
  }
  return [...groups.values()];
}
