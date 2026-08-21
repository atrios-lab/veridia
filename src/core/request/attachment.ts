/**
 * What the citizen may attach to a request. The browser's "accept" attribute
 * is a convenience for the file picker, never a control: these limits are
 * checked on the server, where the upload actually arrives.
 */
export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

// A photograph of a document or a PDF covers everything the counter accepts.
// An office wanting more asks for it; an allowlist that grows on a guess is
// how an executable ends up in the queue.
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
] as const;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

/**
 * ISO base media brands that mean "this is a HEIF still image". Chrome on
 * Windows and Android hand a `.heic` file over with an empty type, so the
 * brand in the file's own header is the only honest signal left.
 */
const HEIC_BRANDS = ["heic", "heix", "mif1", "heim", "heis", "hevc"];

/** How many leading bytes `resolveMimeType` needs to recognise a HEIC file. */
export const SNIFF_BYTES = 12;

function hasHeicExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith(".heic") || lower.endsWith(".heif");
}

function looksLikeHeic(headBytes: Uint8Array): boolean {
  if (headBytes.length < SNIFF_BYTES) return false;
  const ascii = String.fromCharCode(...headBytes.subarray(4, SNIFF_BYTES));
  return ascii.startsWith("ftyp") && HEIC_BRANDS.includes(ascii.slice(4, 8));
}

/**
 * The type to judge the file by. A browser that names the type is believed
 * (it is checked against the allowlist next); one that stays silent on a
 * `.heic` file is answered by reading the file's own header, when the caller
 * has the bytes to read.
 *
 * The client calls this without bytes: there the extension alone is enough,
 * because rejecting early is a courtesy, and the server still decides. The
 * server calls it with the first `SNIFF_BYTES`, where the extension alone
 * would let any renamed file through.
 */
export function resolveMimeType(
  fileName: string,
  mimeType: string,
  headBytes?: Uint8Array,
): string {
  if (mimeType) return mimeType;
  if (!hasHeicExtension(fileName)) return "";
  if (!headBytes) return "image/heic";
  return looksLikeHeic(headBytes) ? "image/heic" : "";
}

export interface IncomingFile {
  mimeType: string;
  size: number;
}

/** An upload the browser already sent to the store, named by its URL. */
export interface UploadedRef extends IncomingFile {
  url: string;
}

export type AttachmentProblem =
  | { kind: "too-many"; limit: number }
  | { kind: "type"; mimeType: string }
  | { kind: "size"; limit: number }
  | { kind: "origin" };

export function describeProblem(problem: AttachmentProblem): string {
  switch (problem.kind) {
    case "too-many":
      return `Envie no máximo ${problem.limit} arquivos.`;
    case "type":
      return "Cada arquivo precisa ser uma imagem (JPG, PNG, WEBP, HEIC) ou um PDF.";
    case "size":
      return `Cada arquivo precisa ter no máximo ${Math.round(problem.limit / (1024 * 1024))} MB.`;
    case "origin":
      return "Não foi possível confirmar o envio do arquivo. Tente anexar de novo.";
  }
}

/** The first problem found, or undefined when the batch may be stored. */
export function checkAttachments(
  files: IncomingFile[],
  limit = MAX_ATTACHMENTS,
): AttachmentProblem | undefined {
  if (files.length > limit) {
    return { kind: "too-many", limit };
  }
  for (const file of files) {
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimeType)) {
      return { kind: "type", mimeType: file.mimeType };
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return { kind: "size", limit: MAX_ATTACHMENT_BYTES };
    }
  }
  return undefined;
}

/**
 * The same limits, applied to files the browser uploaded straight to the
 * store. Everything here arrives from the client, so the URL is checked too:
 * a reference pointing anywhere but our own store would make the request
 * carry a file we never received.
 */
export function checkUploadedAttachments(
  refs: UploadedRef[],
  allowedHost: string,
  limit = MAX_ATTACHMENTS,
): AttachmentProblem | undefined {
  const problem = checkAttachments(refs, limit);
  if (problem) return problem;
  for (const ref of refs) {
    if (!isFromStore(ref.url, allowedHost)) return { kind: "origin" };
  }
  return undefined;
}

function isFromStore(url: string, allowedHost: string): boolean {
  if (!allowedHost) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === allowedHost;
  } catch {
    return false;
  }
}

/** Where a citizen's attachment is stored, inside the blob store. */
export const ATTACHMENT_FOLDER = "anexos";

// Slugs are provisioned by the platform, not typed by a citizen, but the
// route that checks a pathname against one is a security boundary: an
// unrecognised shape is rejected outright rather than interpolated into a
// regex.
const TENANT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const GENERATED_ID = `[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(${Object.values(
  EXTENSIONS,
).join("|")})`;

/**
 * Whether a name the browser asked to upload under is one this system would
 * have generated for this tenant. The browser is free to ask for anything,
 * and the name it knows is the citizen's own file name (which routinely
 * carries their full name), so the shape is checked rather than trusted —
 * and the tenant segment has to match the tenant the request actually
 * belongs to, or nothing here would stop one tenant's site from writing into
 * another's folder.
 */
export function isGeneratedAttachmentPath(
  pathname: string,
  tenantSlug: string,
): boolean {
  if (!TENANT_SLUG_PATTERN.test(tenantSlug)) return false;
  const pattern = new RegExp(
    `^${ATTACHMENT_FOLDER}/${tenantSlug}/${GENERATED_ID}$`,
  );
  return pattern.test(pathname);
}

/**
 * The stored name comes from the type and a random id, never from the name the
 * browser sent: that one is attacker controlled, and it routinely carries the
 * citizen's full name in it. The tenant's own slug is the folder it lands in,
 * so files from different serventias never share a directory.
 */
export function storedFileName(
  mimeType: string,
  id: string,
  tenantSlug: string,
): string {
  const extension = EXTENSIONS[mimeType] ?? "bin";
  return `${tenantSlug}/${id}.${extension}`;
}

/** Positional, for the same reason: "anexo-1" leaks nothing. */
export function displayFileName(index: number): string {
  return `anexo-${index + 1}`;
}
