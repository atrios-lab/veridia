import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { del, head, put } from "@vercel/blob";
import {
  checkAttachments,
  checkUploadedAttachments,
  describeProblem,
  displayFileName,
  isGeneratedAttachmentPath,
  resolveMimeType,
  SNIFF_BYTES,
  storedFileName,
  type UploadedRef,
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

  // `storedName` carries the tenant's own subfolder (see `storedFileName`),
  // so the directory to create is the file's, not just the upload root.
  const path = join(uploadDir(), storedName);
  await mkdir(dirname(path), { recursive: true });
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
  options: {
    tenantSlug: string;
    startIndex?: number;
    kind?: string;
    limit?: number;
  },
): Promise<StoredAttachment[]> {
  // An untouched file input still arrives: a server action encodes it as an
  // empty part named "blob", so the size is the only honest signal that the
  // citizen actually picked something.
  const present = files.filter((f) => f.size > 0);
  if (present.length === 0) return [];

  // Read once, judged once: a browser that named no type (Chrome on Windows
  // does that to every .heic) is answered by the file's own header rather
  // than by its extension, which anything can be renamed to.
  const read = await Promise.all(
    present.map(async (file) => {
      const bytes = Buffer.from(await file.arrayBuffer());
      return {
        bytes,
        size: file.size,
        mimeType: resolveMimeType(
          file.name,
          file.type,
          bytes.subarray(0, SNIFF_BYTES),
        ),
      };
    }),
  );

  const problem = checkAttachments(read, options.limit);
  if (problem) throw new AttachmentError(describeProblem(problem));

  const startIndex = options.startIndex ?? 0;
  const stored: StoredAttachment[] = [];
  for (const [index, file] of read.entries()) {
    const storedName = storedFileName(
      file.mimeType,
      randomUUID(),
      options.tenantSlug,
    );
    const path = await store(file.bytes, storedName, file.mimeType);
    stored.push({
      storedName,
      displayName: options.kind ?? displayFileName(startIndex + index),
      path,
      mimeType: file.mimeType,
      sizeBytes: file.size,
    });
  }
  return stored;
}

/**
 * The other half of the same job, for files the browser already uploaded
 * straight to the store. Nothing here is trusted because the client said so:
 * count, type and size go through the same core check, the URL has to belong
 * to our own store, and the size is read back from the blob itself: a client
 * is free to declare a 1 KB file and upload 400 MB.
 */
export async function acceptUploadedAttachments(
  refs: UploadedRef[],
  options: {
    tenantSlug: string;
    startIndex?: number;
    kind?: string;
    limit?: number;
  },
): Promise<StoredAttachment[]> {
  if (refs.length === 0) return [];

  const host = process.env.BLOB_PUBLIC_HOST ?? "";
  const problem = checkUploadedAttachments(refs, host, options.limit);
  if (problem) throw new AttachmentError(describeProblem(problem));

  const startIndex = options.startIndex ?? 0;
  const stored: StoredAttachment[] = [];
  for (const [index, ref] of refs.entries()) {
    const blob = await head(ref.url);
    // The token route already restricted which pathname could be uploaded
    // to, but this is the checkpoint that ties a blob to a citizen's record:
    // worth confirming again here that it still sits under this tenant's own
    // folder, not just the store's own host.
    if (!isGeneratedAttachmentPath(blob.pathname, options.tenantSlug)) {
      throw new AttachmentError(describeProblem({ kind: "origin" }));
    }
    const declared = checkAttachments(
      [{ mimeType: blob.contentType ?? ref.mimeType, size: blob.size }],
      options.limit,
    );
    if (declared) throw new AttachmentError(describeProblem(declared));

    stored.push({
      // The blob's own pathname is already the generated name this deploy
      // asked for (see the upload route), minus the folder.
      storedName: blob.pathname.split("/").pop() ?? blob.pathname,
      displayName: options.kind ?? displayFileName(startIndex + index),
      path: ref.url,
      mimeType: blob.contentType ?? ref.mimeType,
      sizeBytes: blob.size,
    });
  }
  return stored;
}

/**
 * The attachments a form carries, whichever way they travelled: references to
 * blobs the browser already uploaded, or the files themselves in the request
 * body. Every citizen-facing action goes through here so neither path can be
 * validated in one place and forgotten in the other.
 */
export async function collectAttachments(
  formData: FormData,
  field: string,
  options: {
    tenantSlug: string;
    startIndex?: number;
    kind?: string;
    limit?: number;
  },
): Promise<StoredAttachment[]> {
  const refs = formData.getAll(`${field}Ref`).map(parseRef);
  if (refs.length > 0) return acceptUploadedAttachments(refs, options);

  const files = formData
    .getAll(field)
    .filter((value): value is File => value instanceof File);
  return storeAttachments(files, options);
}

function parseRef(value: FormDataEntryValue): UploadedRef {
  try {
    const parsed = JSON.parse(String(value)) as UploadedRef;
    if (
      typeof parsed?.url === "string" &&
      typeof parsed?.mimeType === "string" &&
      typeof parsed?.size === "number"
    ) {
      return parsed;
    }
  } catch {
    // Falls through to the same error a tampered reference gets.
  }
  throw new AttachmentError(
    "Não foi possível confirmar o envio do arquivo. Tente anexar de novo.",
  );
}

/** Whether this deploy uploads straight from the browser to the store. */
export function blobUploadEnabled(): boolean {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN && process.env.BLOB_PUBLIC_HOST,
  );
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

  // `storedName` carries the tenant's own subfolder (see `brandImageFileName`).
  const path = join(brandImageDevDir(), storedName);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
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
  tenantSlug: string,
): Promise<string> {
  const problem = checkBrandImage(kind, {
    mimeType: file.type,
    size: file.size,
  });
  if (problem) throw new BrandImageError(describeBrandImageProblem(problem));

  const storedName = brandImageFileName(file.type, randomUUID(), tenantSlug);
  const bytes = Buffer.from(await file.arrayBuffer());
  return storeBrandBytes(bytes, storedName, file.type);
}
