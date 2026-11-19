import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { put } from "@vercel/blob";
import type { NewsFileKind } from "@/core/news/news.ts";
import { assertDiskFallbackAllowed, deleteStoredFile } from "./uploads.ts";

/**
 * Where the notice board's files are kept (photos and the PDF): under the
 * office's own folder, in the store of the deploy or on disk in
 * development. The files are served by routes that check what may be
 * public; a path never reaches the browser.
 */

export const newsFolder = (tenantSlug: string) => `noticias/${tenantSlug}/`;

/** Writes the bytes; returns the path the row keeps (blob URL or disk path). */
export async function storeNewsFile(
  tenantSlug: string,
  kind: NewsFileKind,
  bytes: Uint8Array,
  fileName: string,
  mime: string,
): Promise<string> {
  const safe = fileName.replace(/[^\w.-]+/g, "_").slice(-80) || "arquivo";
  const path = `${newsFolder(tenantSlug)}${kind}/${randomUUID()}/${safe}`;
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
export async function removeNewsFile(path: string | null): Promise<void> {
  if (path) await deleteStoredFile(path);
}
