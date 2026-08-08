/**
 * What the citizen may attach to a request. The browser's "accept" attribute
 * is a convenience for the file picker, never a control: these limits are
 * checked on the server, where the upload actually arrives.
 */
export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

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

export interface IncomingFile {
  mimeType: string;
  size: number;
}

export type AttachmentProblem =
  | { kind: "too-many"; limit: number }
  | { kind: "type"; mimeType: string }
  | { kind: "size"; limit: number };

export function describeProblem(problem: AttachmentProblem): string {
  switch (problem.kind) {
    case "too-many":
      return `Envie no máximo ${problem.limit} arquivos.`;
    case "type":
      return "Cada arquivo precisa ser uma imagem (JPG, PNG, WEBP, HEIC) ou um PDF.";
    case "size":
      return `Cada arquivo precisa ter no máximo ${Math.round(problem.limit / (1024 * 1024))} MB.`;
  }
}

/** The first problem found, or undefined when the batch may be stored. */
export function checkAttachments(
  files: IncomingFile[],
): AttachmentProblem | undefined {
  if (files.length > MAX_ATTACHMENTS) {
    return { kind: "too-many", limit: MAX_ATTACHMENTS };
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
 * The stored name comes from the type and a random id, never from the name the
 * browser sent: that one is attacker controlled, and it routinely carries the
 * citizen's full name in it.
 */
export function storedFileName(mimeType: string, id: string): string {
  const extension = EXTENSIONS[mimeType] ?? "bin";
  return `${id}.${extension}`;
}

/** Positional, for the same reason: "anexo-1" leaks nothing. */
export function displayFileName(index: number): string {
  return `anexo-${index + 1}`;
}
