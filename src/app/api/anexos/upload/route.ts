import { type HandleUploadBody, handleUpload } from "@vercel/blob/client";
import {
  ALLOWED_MIME_TYPES,
  isGeneratedAttachmentPath,
  MAX_ATTACHMENT_BYTES,
} from "@/core/request/attachment.ts";
import { isUploadRateLimited } from "@/lib/rate-limit.ts";

/**
 * Issues the short-lived token the browser needs to upload one attachment
 * straight to the Blob store. The bytes never pass through this function:
 * that is the whole point, since a platform function's request body is capped
 * far below what a photograph of a document weighs.
 *
 * The token is not a session. It authorises writing one blob under a name
 * this route accepts, nothing else: it says nothing about which request the
 * file belongs to, because that decision belongs to the server action, which
 * checks the citizen's protocol and key before tying anything to a record.
 */

export async function POST(request: Request): Promise<Response> {
  // No store configured means this deploy uploads through the server action
  // instead (development). Answering anything else would invite a client to
  // keep retrying a route that cannot work here.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      { error: "Upload direto indisponível." },
      {
        status: 404,
      },
    );
  }

  if (await isUploadRateLimited(request.headers)) {
    return Response.json(
      { error: "Muitos envios seguidos. Aguarde um minuto e tente de novo." },
      { status: 429 },
    );
  }

  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // The name has to be one this system would have generated: a bare
        // UUID under the attachments folder, never what the browser knows.
        if (!isGeneratedAttachmentPath(pathname)) {
          throw new Error("pathname recusado");
        }
        return {
          allowedContentTypes: [...ALLOWED_MIME_TYPES],
          maximumSizeInBytes: MAX_ATTACHMENT_BYTES,
          // The suffix is the store's, not the client's: it makes a second
          // upload to the same name a new blob instead of an overwrite, so
          // nobody can swap the file an office has already read.
          addRandomSuffix: true,
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    console.error("anexos.upload-token", error);
    return Response.json(
      { error: "Não foi possível enviar o arquivo agora." },
      { status: 400 },
    );
  }
}
