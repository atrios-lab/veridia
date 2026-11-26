import { type HandleUploadBody, handleUpload } from "@vercel/blob/client";
import { can } from "@/core/auth/roles.ts";
import { RI_FILE_MAX_BYTES, riFolder } from "@/lib/ri-files.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

/**
 * The short-lived token the browser needs to send a file of the Registro
 * de Imóveis straight to the store: a ficha scanned in colour, a whole
 * título, a large file to import, do not fit in a function's request body.
 * Only for `ri.edit` or `ri.import`, and only under the office's own RI
 * folder; saving it is the server action's job, after it checks the URL is
 * one this route could have issued.
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
    !(
      can(session.user.role ?? "", "ri.edit", session.user.permissions) ||
      can(session.user.role ?? "", "ri.import", session.user.permissions)
    )
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
          !pathname.startsWith(riFolder(tenant.slug)) ||
          pathname.includes("..")
        ) {
          throw new Error("pathname recusado");
        }
        return { maximumSizeInBytes: RI_FILE_MAX_BYTES, addRandomSuffix: true };
      },
    });
    return Response.json(result);
  } catch (error) {
    console.error("ri.upload-token", error);
    return Response.json(
      { error: "Não foi possível enviar o arquivo agora." },
      { status: 400 },
    );
  }
}
