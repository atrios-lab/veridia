"use client";

import { upload } from "@vercel/blob/client";
import { createContext, startTransition, useContext, useState } from "react";
import {
  ATTACHMENT_FOLDER,
  checkAttachments,
  describeProblem,
  MAX_ATTACHMENTS,
  resolveMimeType,
  storedFileName,
} from "@/core/request/attachment.ts";

/**
 * The file picker's convenience list. Extensions ride along with the media
 * types because a Windows picker greys out `.heic` files when it is only
 * told `image/heic`: the very files this office is most often sent.
 */
export const ATTACHMENT_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.heic,.heif";

/**
 * Whether this deploy uploads straight from the browser to the Blob store.
 * A context, not a prop threaded through a dozen components: it is one
 * boolean the whole public site reads, decided once on the server.
 */
const BlobUploadContext = createContext(false);

export function BlobUploadProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  return <BlobUploadContext value={enabled}>{children}</BlobUploadContext>;
}

function pickedFiles(data: FormData, field: string): File[] {
  // An untouched file input still arrives, as an empty part: size is the only
  // honest signal that the citizen actually chose something.
  return data
    .getAll(field)
    .filter((value): value is File => value instanceof File)
    .filter((file) => file.size > 0);
}

/**
 * The same limits the server enforces, applied at the moment of picking.
 * Without the file's bytes the extension is all there is to go on for a
 * type-less `.heic`; the server reads the header and has the last word.
 */
export function validateAttachments(
  files: File[],
  limit = MAX_ATTACHMENTS,
): string | undefined {
  const problem = checkAttachments(
    files.map((file) => ({
      mimeType: resolveMimeType(file.name, file.type),
      size: file.size,
    })),
    limit,
  );
  return problem ? describeProblem(problem) : undefined;
}

async function uploadOne(file: File) {
  const mimeType = resolveMimeType(file.name, file.type);
  // The name is a bare UUID: the route refuses anything else, because the
  // name the browser knows is the citizen's own and says who they are.
  const pathname = `${ATTACHMENT_FOLDER}/${storedFileName(mimeType, crypto.randomUUID())}`;
  const blob = await upload(pathname, file, {
    access: "public",
    contentType: mimeType,
    handleUploadUrl: "/api/anexos/upload",
  });
  return { url: blob.url, mimeType, size: file.size };
}

/**
 * Sends a form whose attachments must not travel in its body. The files go
 * to the store first, straight from the browser, and the action receives
 * references to them instead: a platform function's request body is capped
 * far below one photograph of a document, which is why this exists.
 *
 * Where the store is not configured (development), the files stay in the
 * body and the action stores them itself, exactly as before.
 */
export function useAttachmentPrepare() {
  const enabled = useContext(BlobUploadContext);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();

  /**
   * The form's data with its attachments already where the server expects
   * them, or undefined when the files were refused, in which case `error`
   * is what the citizen needs to read.
   */
  async function prepare(
    data: FormData,
    field: string,
    limit = MAX_ATTACHMENTS,
  ): Promise<FormData | undefined> {
    const files = pickedFiles(data, field);

    const problem = validateAttachments(files, limit);
    if (problem) {
      setError(problem);
      return undefined;
    }
    setError(undefined);
    if (!enabled || files.length === 0) return data;

    setUploading(true);
    try {
      const refs = await Promise.all(files.map(uploadOne));
      data.delete(field);
      for (const ref of refs) {
        data.append(`${field}Ref`, JSON.stringify(ref));
      }
      return data;
    } catch (uploadError) {
      console.error("anexos.upload", uploadError);
      setError("Não foi possível enviar o arquivo. Tente de novo.");
      return undefined;
    } finally {
      setUploading(false);
    }
  }

  return { prepare, uploading, error, setError };
}

/** The same, for a form whose send is a server action. */
export function useAttachmentUpload(action: (data: FormData) => void) {
  const { prepare, uploading, error, setError } = useAttachmentPrepare();

  async function send(
    form: HTMLFormElement,
    field: string,
    limit = MAX_ATTACHMENTS,
  ) {
    const data = await prepare(new FormData(form), field, limit);
    if (data) startTransition(() => action(data));
  }

  return { send, uploading, error, setError };
}
