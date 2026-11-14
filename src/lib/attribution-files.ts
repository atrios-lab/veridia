import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { put } from "@vercel/blob";
import { and, desc, eq, isNull } from "drizzle-orm";
import { recognizeFile } from "@/core/attributions/files.ts";
import { guideFor } from "@/core/attributions/guides.ts";
import type { Database } from "@/db/index.ts";
import { attributionFiles } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import { assertDiskFallbackAllowed } from "./uploads.ts";

/**
 * The files of each attribution (decision of 14/11/2026): sent in any
 * format, recognised by their content, kept as they came. The same file is
 * not taken twice in the same attribution. Nothing here deletes: an
 * exclusion marks the row and the stored file stays.
 */

export class AttributionFileError extends Error {}

export type AttributionFileRow = typeof attributionFiles.$inferSelect;

export const attributionFolder = (tenantSlug: string) =>
  `atribuicoes/${tenantSlug}/`;

const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

function assertAttribution(slug: string): void {
  if (!guideFor(slug))
    throw new AttributionFileError("Atribuição desconhecida.");
}

/** Writes the bytes under the office's folder (the store, or disk in dev). */
export async function storeAttributionFile(
  tenantSlug: string,
  attribution: string,
  bytes: Uint8Array,
  fileName: string,
): Promise<string> {
  assertAttribution(attribution);
  const safe = fileName.replace(/[^\w.-]+/g, "_").slice(-80) || "arquivo";
  const path = `${attributionFolder(tenantSlug)}${attribution}/${randomUUID()}/${safe}`;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(path, Buffer.from(bytes), {
      access: "public",
      addRandomSuffix: true,
      contentType: "application/octet-stream",
    });
    return blob.url;
  }
  assertDiskFallbackAllowed();
  const full = join(resolve(process.env.UPLOAD_DIR ?? "./var/uploads"), path);
  await mkdir(join(full, ".."), { recursive: true });
  await writeFile(full, bytes);
  return full;
}

export async function addAttributionFileWith(
  database: Database,
  tenantSlug: string,
  input: {
    attribution: string;
    fileName: string;
    description: string;
    bytes: Uint8Array;
    storedPath: string;
    uploadedBy: string;
  },
): Promise<string> {
  assertAttribution(input.attribution);
  if (input.bytes.byteLength === 0) {
    throw new AttributionFileError("O arquivo está vazio.");
  }
  const hash = sha256(input.bytes);
  const [same] = await database
    .select({ createdAt: attributionFiles.createdAt })
    .from(attributionFiles)
    .where(
      and(
        eq(attributionFiles.tenantSlug, tenantSlug),
        eq(attributionFiles.attribution, input.attribution),
        eq(attributionFiles.sha256, hash),
        isNull(attributionFiles.removedAt),
      ),
    )
    .limit(1);
  if (same) {
    throw new AttributionFileError(
      `Este mesmo arquivo já foi enviado em ${same.createdAt.toLocaleDateString("pt-BR")}.`,
    );
  }
  const kind = recognizeFile(input.bytes, input.fileName);
  const [row] = await database
    .insert(attributionFiles)
    .values({
      tenantSlug,
      attribution: input.attribution,
      fileName: input.fileName.slice(0, 300),
      description: input.description.trim().slice(0, 500),
      sizeBytes: input.bytes.byteLength,
      sha256: hash,
      storedPath: input.storedPath,
      format: kind.label,
      uploadedBy: input.uploadedBy,
    })
    .returning({ id: attributionFiles.id });
  if (!row) throw new AttributionFileError("Não foi possível guardar agora.");
  await recordAuditWith(database, {
    tenantSlug,
    actorId: input.uploadedBy,
    action: "attributions.file.upload",
    targetType: "attribution-file",
    targetId: row.id,
  });
  return row.id;
}

export async function listAttributionFilesWith(
  database: Database,
  tenantSlug: string,
  attribution: string,
): Promise<AttributionFileRow[]> {
  return database
    .select()
    .from(attributionFiles)
    .where(
      and(
        eq(attributionFiles.tenantSlug, tenantSlug),
        eq(attributionFiles.attribution, attribution),
        isNull(attributionFiles.removedAt),
      ),
    )
    .orderBy(desc(attributionFiles.createdAt))
    .limit(200);
}

export async function getAttributionFileWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<AttributionFileRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await database
    .select()
    .from(attributionFiles)
    .where(
      and(
        eq(attributionFiles.tenantSlug, tenantSlug),
        eq(attributionFiles.id, id),
        isNull(attributionFiles.removedAt),
      ),
    );
  return row ?? null;
}

/** Marks it excluded: the row, the stored file and the audit stay. */
export async function removeAttributionFileWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actorId: string,
  reason: string,
): Promise<AttributionFileRow> {
  const row = await getAttributionFileWith(database, tenantSlug, id);
  if (!row) throw new AttributionFileError("Arquivo não encontrado.");
  await database
    .update(attributionFiles)
    .set({
      removedAt: new Date(),
      removedBy: actorId,
      removedReason: reason.slice(0, 5000),
    })
    .where(eq(attributionFiles.id, row.id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "attributions.file.remove",
    targetType: "attribution-file",
    targetId: row.id,
    reason,
  });
  return row;
}
