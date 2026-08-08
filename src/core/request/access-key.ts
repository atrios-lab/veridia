import { createHash, randomInt, timingSafeEqual } from "node:crypto";

/**
 * No I, L, O, U, 0 or 1: the key is dictated over the phone and copied off a
 * printed form, and those are the characters people get wrong.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const GROUPS = 3;
const GROUP_SIZE = 4;

/**
 * The citizen's only credential. There is no account and no password: the
 * protocol says which request, and this says it is really theirs.
 *
 * randomInt, not Math.random: this is the whole access control for a file with
 * someone's documents in it.
 */
export function generateAccessKey(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    let group = "";
    for (let c = 0; c < GROUP_SIZE; c++) {
      group += ALPHABET[randomInt(ALPHABET.length)];
    }
    groups.push(group);
  }
  return groups.join("-");
}

/**
 * Strips what a person adds by hand: lowercase, spaces, missing or extra
 * dashes. Typing the key back in must not fail on punctuation.
 */
export function normalizeAccessKey(key: string): string {
  return key.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * SHA-256 with no salt on purpose: the key is twelve random characters from a
 * thirty character alphabet, so there is nothing to guess from a rainbow
 * table, and the lookup has to find the row by hash.
 */
export function hashAccessKey(key: string): string {
  return createHash("sha256").update(normalizeAccessKey(key)).digest("hex");
}

/** Constant time, so a wrong key cannot be narrowed down by timing it. */
export function verifyAccessKey(key: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashAccessKey(key), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
