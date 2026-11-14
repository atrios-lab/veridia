import { type HandleUploadBody, handleUpload } from "@vercel/blob/client";
import { can } from "@/core/auth/roles.ts";
import { attributionFolder } from "@/lib/attribution-files.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

/** A book's base or a central's return can be large. */
const MAX_BYTES = 500 * 1024 * 1024;

/**
 * The short-lived token to send one attribution file straight to the store
 * (the same mechanism as the Registro Civil's). Only to a session holding
 * `attributions.import`, and only under the office's own folder; the server
 * action checks the address again before keeping the file.
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
    !can(
      session.user.role ?? "",
      "attributions.import",
      session.user.permissions,
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
          !pathname.startsWith(attributionFolder(tenant.slug)) ||
          pathname.includes("..")
        ) {
          throw new Error("pathname recusado");
        }
        return { maximumSizeInBytes: MAX_BYTES, addRandomSuffix: true };
      },
    });
    return Response.json(result);
  } catch (error) {
    console.error("attributions.upload-token", error);
    return Response.json(
      { error: "Não foi possível enviar o arquivo agora." },
      { status: 400 },
    );
  }
}
