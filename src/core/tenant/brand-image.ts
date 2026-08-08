/**
 * What the office may send as its own imagery: logotype (light and dark
 * variants) and the home hero photograph. Same discipline as
 * core/request/attachment.ts, validated here before anything ever touches
 * disk or the network, so the pure rule can be tested without either.
 */
export type BrandImageKind = "logo-light" | "logo-dark" | "hero";

const LOGO_MAX_BYTES = 1 * 1024 * 1024;
const HERO_MAX_BYTES = 4 * 1024 * 1024;

const MAX_BYTES: Record<BrandImageKind, number> = {
  "logo-light": LOGO_MAX_BYTES,
  "logo-dark": LOGO_MAX_BYTES,
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

/** The stored name, from the type and a random id, never from the sent name. */
export function brandImageFileName(mimeType: string, id: string): string {
  const extension =
    EXTENSIONS[mimeType as (typeof ALLOWED_BRAND_MIME_TYPES)[number]] ?? "bin";
  return `${id}.${extension}`;
}
