/**
 * What the office may send as its own imagery: logotype and seal (each with
 * a light and a dark variant) and the home hero photograph. Same discipline as
 * core/request/attachment.ts, validated here before anything ever touches
 * disk or the network, so the pure rule can be tested without either.
 */
export type BrandImageKind =
  | "logo-light"
  | "logo-dark"
  | "seal-light"
  | "seal-dark"
  | "hero";

const LOGO_MAX_BYTES = 1 * 1024 * 1024;
const HERO_MAX_BYTES = 4 * 1024 * 1024;

const MAX_BYTES: Record<BrandImageKind, number> = {
  "logo-light": LOGO_MAX_BYTES,
  "logo-dark": LOGO_MAX_BYTES,
  "seal-light": LOGO_MAX_BYTES,
  "seal-dark": LOGO_MAX_BYTES,
  hero: HERO_MAX_BYTES,
};

export const ALLOWED_BRAND_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

const EXTENSIONS: Record<(typeof ALLOWED_BRAND_MIME_TYPES)[number], string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export interface IncomingBrandImage {
  mimeType: string;
  size: number;
}

export type BrandImageProblem =
  | { kind: "type"; mimeType: string }
  | { kind: "size"; limit: number };

export function describeBrandImageProblem(problem: BrandImageProblem): string {
  switch (problem.kind) {
    case "type":
      return "A imagem precisa ser PNG, JPG ou WEBP.";
    case "size":
      return `A imagem precisa ter no máximo ${Math.round(problem.limit / (1024 * 1024))} MB.`;
  }
}

/** The first problem found, or undefined when the file may be stored. */
export function checkBrandImage(
  kind: BrandImageKind,
  file: IncomingBrandImage,
): BrandImageProblem | undefined {
  if (
    !(ALLOWED_BRAND_MIME_TYPES as readonly string[]).includes(file.mimeType)
  ) {
    return { kind: "type", mimeType: file.mimeType };
  }
  const limit = MAX_BYTES[kind];
  if (file.size > limit) return { kind: "size", limit };
  return undefined;
}

/**
 * The stored name, from the type and a random id, never from the sent name.
 * The tenant's own slug is the folder it lands in, so brand images from
 * different serventias never share a directory.
 */
export function brandImageFileName(
  mimeType: string,
  id: string,
  tenantSlug: string,
): string {
  const extension =
    EXTENSIONS[mimeType as (typeof ALLOWED_BRAND_MIME_TYPES)[number]] ?? "bin";
  return `${tenantSlug}/${id}.${extension}`;
}

/**
 * The absolute URL of a stored brand image. An office that sent its own
 * image is already holding an absolute URL from the blob store; one still on
 * the file shipped in config holds a path relative to its own site, which an
 * e-mail client has no way to resolve. Prefixing the host unconditionally is
 * what turned a freshly uploaded seal into a broken image in every notice.
 *
 * An office with no host registered gets an empty string: a header with no
 * seal, rather than a link to nowhere.
 */
export function brandImageUrl(
  stored: string,
  host: string | undefined,
): string {
  if (/^https?:\/\//.test(stored)) return stored;
  return host ? `https://${host}${stored}` : "";
}
