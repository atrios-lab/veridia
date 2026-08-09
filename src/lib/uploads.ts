import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { del, put } from "@vercel/blob";
import {
  checkAttachments,
  describeProblem,
  displayFileName,
  storedFileName,
} from "@/core/request/attachment.ts";
import {
  type BrandImageKind,
  brandImageFileName,
  checkBrandImage,
  describeBrandImageProblem,
} from "@/core/tenant/brand-image.ts";

export interface StoredAttachment {
  storedName: string;
  displayName: string;
  /** Disk path or blob URL. Server side only: it never reaches the browser. */
  path: string;
  mimeType: string;
  sizeBytes: number;
}

function uploadDir(): string {
  return resolve(process.env.UPLOAD_DIR ?? "./var/uploads");
}

// Brand images need a public URL (unlike a citizen's attachment, which must
// never reach the browser), so development writes them under `public/`,
// served by Next itself, instead of `var/uploads`.
function brandImageDevDir(): string {
  return resolve("./public/uploads/marca");
}

/**
 * Blob in the deploy, disk in development. On Vercel the filesystem is
 * ephemeral, so writing a citizen's document to it would lose the document on
 * the next request, which is the kind of failure nobody notices until someone
 * asks for their file back.
 */
async function store(
  bytes: Buffer,
  storedName: string,
  mimeType: string,
): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    // ponytail: public blob with a random URL, and the URL never leaves the
    // server. Move to signed URLs if these files ever need real secrecy.
    const blob = await put(`anexos/${storedName}`, bytes, {
      access: "public",
      contentType: mimeType,
      addRandomSuffix: false,
    });
    return blob.url;
  }

  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  const path = join(dir, storedName);
  await writeFile(path, bytes);
  return path;
}

/**
 * Removes a file written by `store`. Best-effort: the DB row is the source
 * of truth, so a storage-side failure here shouldn't stop the delete the
 * admin asked for, only leave an orphaned file behind.
 */
export async function deleteStoredFile(path: string): Promise<void> {
  try {
    if (path.startsWith("http")) {
      await del(path);
    } else {
      await unlink(path);
    }
  } catch (error) {
    console.error("uploads.delete", error);
  }
}

export class AttachmentError extends Error {}

/**
 * Validates the whole batch before writing any of it, so a rejected upload
 * never leaves half the files behind. Type and size are checked here, on the
 * server: the input's "accept" attribute is a file picker convenience.
 */
export async function storeAttachments(
  files: File[],
  options: { startIndex?: number; kind?: string } = {},
): Promise<StoredAttachment[]> {
  // An untouched file input still arrives: a server action encodes it as an
  // empty part named "blob", so the size is the only honest signal that the
  // citizen actually picked something.
  const present = files.filter((f) => f.size > 0);
  if (present.length === 0) return [];

  const problem = checkAttachments(
    present.map((f) => ({ mimeType: f.type, size: f.size })),
  );
  if (problem) throw new AttachmentError(describeProblem(problem));

  const startIndex = options.startIndex ?? 0;
  const stored: StoredAttachment[] = [];
  for (const [index, file] of present.entries()) {
    const storedName = storedFileName(file.type, randomUUID());
    const bytes = Buffer.from(await file.arrayBuffer());
    const path = await store(bytes, storedName, file.type);
    stored.push({
      storedName,
      displayName: options.kind ?? displayFileName(startIndex + index),
      path,
      mimeType: file.type,
      sizeBytes: file.size,
    });
  }
  return stored;
}

export class BrandImageError extends Error {}

async function storeBrandBytes(
  bytes: Buffer,
  storedName: string,
  mimeType: string,
): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`marca/${storedName}`, bytes, {
      access: "public",
      contentType: mimeType,
      addRandomSuffix: false,
    });
    return blob.url;
  }

  const dir = brandImageDevDir();
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, storedName), bytes);
  return `/uploads/marca/${storedName}`;
}

/**
 * Validates and stores one brand image (a logotype variant or the hero
 * photo), returning its public URL. Throws before writing anything when the
 * file fails validation, same discipline as `storeAttachments`, so a
 * rejected upload never leaves a half-written file behind.
 *
 * The caller decides whether to call this at all: an empty file input means
 * "keep the image currently published", and that decision belongs to the
 * action reading the form, not to this function.
 */
export async function storeBrandImage(
  file: File,
  kind: BrandImageKind,
): Promise<string> {
  const problem = checkBrandImage(kind, {
    mimeType: file.type,
    size: file.size,
  });
  if (problem) throw new BrandImageError(describeBrandImageProblem(problem));

  const storedName = brandImageFileName(file.type, randomUUID());
  const bytes = Buffer.from(await file.arrayBuffer());
  return storeBrandBytes(bytes, storedName, file.type);
}
