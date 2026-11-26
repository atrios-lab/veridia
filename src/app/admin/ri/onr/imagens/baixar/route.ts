import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { onrImageFileWith, onrZipWith } from "@/lib/ri-onr-images.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * `?id=`: one image (00000001.TIF). Without it: the images in force in a
 * zip with the folders of the manual (`?pendentes=1`: only the ones not yet
 * copied to the folder of the CSL2; `?ids=a,b`: the chosen ones).
 */
export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "ri.export", session.user.permissions)
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const query = new URL(request.url).searchParams;
  const id = query.get("id");
  if (id) {
    const file = await onrImageFileWith(db, tenant.slug, id);
    if (!file) return new Response("Não encontrada", { status: 404 });
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": "image/tiff",
        "Content-Disposition": `attachment; filename="${file.path.split("/").at(-1)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  const ids = (query.get("ids") ?? "").split(",").filter(Boolean);
  const zip = await onrZipWith(db, tenant.slug, {
    ids,
    onlyNotCopied: query.get("pendentes") === "1",
  });
  if (zip.count === 0) {
    return new Response("Nenhuma imagem para baixar.", { status: 404 });
  }
  return new Response(new Uint8Array(zip.bytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="imagens-onr-livro-2.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
