import { type HandleUploadBody, handleUpload } from "@vercel/blob/client";
import { can } from "@/core/auth/roles.ts";
import { RCPN_MAX_BYTES } from "@/core/rcpn/limits.ts";
import { rcpnFolder } from "@/lib/rcpn.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

/** The registry system's exports can be large: the whole base, packed. */
const MAX_BYTES = RCPN_MAX_BYTES;

/**
 * Issues the short-lived token the browser needs to send one RCPN file
 * straight to the store (the same mechanism as the tutorials'): an Access
 * base does not fit in a function's request body. Only to a session holding
 * `rcpn.import`, and only for a name under the office's own RCPN folder;
 * reading it and opening the import is the server action's job, after it
 * checks the URL is one this route could have issued.
 *
 * Any content type: the panel accepts every file (design, decision 1).
 */
export async function POST(request: Request): Promise<Response> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      { error: "Upload direto indisponível." },
      { status: 404 },
    );
  }
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "rcpn.import", session.user.permissions)
  ) {
    return Response.json({ error: "Não encontrado." }, { status: 404 });
  }
  const tenant = await getTenant();
  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (
          !pathname.startsWith(rcpnFolder(tenant.slug)) ||
          pathname.includes("..")
        ) {
          throw new Error("pathname recusado");
        }
        return { maximumSizeInBytes: MAX_BYTES, addRandomSuffix: true };
      },
    });
    return Response.json(result);
  } catch (error) {
    console.error("rcpn.upload-token", error);
    return Response.json(
      { error: "Não foi possível enviar o arquivo agora." },
      { status: 400 },
    );
  }
}
