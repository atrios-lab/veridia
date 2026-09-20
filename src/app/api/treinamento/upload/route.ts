import { type HandleUploadBody, handleUpload } from "@vercel/blob/client";
import { can } from "@/core/auth/roles.ts";
import {
  isGeneratedTutorialPath,
  MAX_CAPTIONS_BYTES,
  MAX_VIDEO_BYTES_DIRECT,
  TUTORIAL_MIME_TYPES,
  tutorialPathKind,
} from "@/core/tutorials/video.ts";
import { getSession } from "@/lib/session.ts";

/**
 * Issues the short-lived token the browser needs to upload one tutorial
 * file straight to the Blob store. Same mechanism as the citizen's
 * attachments (src/app/api/anexos/upload/route.ts), for the same reason: a
 * video does not fit in a platform function's request body, so the bytes
 * never come through here.
 *
 * Unlike that route, this one is not public. The token is only ever issued
 * to a session holding `tutorials.manage`, which the superadmin role alone
 * has; anyone else gets the same 404 the management screen gives them. The
 * token still authorises one name under the tutorial folder and nothing
 * else: tying the file to a row is the server action's job, after it
 * checks the URL is one this route could have issued.
 */
export async function POST(request: Request): Promise<Response> {
  // No store means this deploy uploads through the server action instead
  // (development). Answering anything else would invite a retry loop.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      { error: "Upload direto indisponível." },
      { status: 404 },
    );
  }

  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "tutorials.manage")) {
    return Response.json({ error: "Não encontrado." }, { status: 404 });
  }

  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const kind = tutorialPathKind(pathname);
        if (!kind || !isGeneratedTutorialPath(pathname)) {
          throw new Error("pathname recusado");
        }
        return {
          allowedContentTypes: [TUTORIAL_MIME_TYPES[kind]],
          maximumSizeInBytes:
            kind === "video" ? MAX_VIDEO_BYTES_DIRECT : MAX_CAPTIONS_BYTES,
          // The name carries the row's own uuid, minted by the form for
          // this upload, so it is unique already; a suffix would only stop
          // the row from knowing its file's URL before the upload ends.
          addRandomSuffix: false,
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    console.error("treinamento.upload-token", error);
    return Response.json(
      { error: "Não foi possível enviar o arquivo agora." },
      { status: 400 },
    );
  }
}
