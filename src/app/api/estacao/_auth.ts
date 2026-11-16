import "server-only";
import { db } from "@/db/index.ts";
import { type StationRow, stationByKeyWith } from "@/lib/signing-stations.ts";

/**
 * The station of the request: the Assinador Veridia sends its key as
 * `Authorization: Bearer <chave>` (decision of 16/11/2026). Only the hash
 * of the key is kept; a station switched off is not found.
 */
export async function stationOf(
  request: Request,
): Promise<StationRow | undefined> {
  const header = request.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return key ? stationByKeyWith(db, key) : undefined;
}

export const noStore = { "Cache-Control": "no-store" } as const;

/** The body, read up to a limit: a station never sends more than this. */
export async function bodyOf(
  request: Request,
  limit: number,
): Promise<unknown> {
  const text = await request.text();
  if (text.length > limit) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
