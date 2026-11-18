import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { put } from "@vercel/blob";
import type { TeamFileKind } from "@/core/team/team.ts";
import { assertDiskFallbackAllowed, deleteStoredFile } from "./uploads.ts";

/**
 * Where the team's files are kept (photo, portaria, Word): under the
 * office's own folder, in the store of the deploy or on disk in development.
 * The files are served by routes that check what may be public; a path
 * never reaches the browser.
 */

export const teamFolder = (tenantSlug: string) => `equipe/${tenantSlug}/`;

/** Writes the bytes; returns the path the row keeps (blob URL or disk path). */
export async function storeTeamFile(
  tenantSlug: string,
  kind: TeamFileKind,
  bytes: Uint8Array,
  fileName: string,
  mime: string,
): Promise<string> {
  const safe = fileName.replace(/[^\w.-]+/g, "_").slice(-80) || "arquivo";
  const path = `${teamFolder(tenantSlug)}${kind}/${randomUUID()}/${safe}`;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(path, Buffer.from(bytes), {
      access: "public",
      addRandomSuffix: true,
      contentType: mime,
    });
    return blob.url;
  }
  assertDiskFallbackAllowed();
  const full = join(resolve(process.env.UPLOAD_DIR ?? "./var/uploads"), path);
  await mkdir(join(full, ".."), { recursive: true });
  await writeFile(full, bytes);
  return full;
}

/** Removes a file that was replaced or taken off (best effort). */
export async function removeTeamFile(path: string | null): Promise<void> {
  if (path) await deleteStoredFile(path);
}
