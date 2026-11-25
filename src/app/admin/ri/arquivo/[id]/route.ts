import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { fileWith } from "@/lib/ri-files.ts";
import { imageToBwTiff } from "@/lib/ri-tiff.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { readStoredFile } from "@/lib/uploads.ts";

export const runtime = "nodejs";

/**
 * A file attached in the Registro de Imóveis, as it was sent; with
 * `?formato=tiff`, a scanned image as the ONR's black and white TIFF (G4).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "ri.view", session.user.permissions)
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const file = await fileWith(db, tenant.slug, (await params).id);
  if (!file) return new Response("Não encontrado", { status: 404 });
  const bytes = await readStoredFile(file.path);
  const safe = file.name.replace(/[^\w.-]+/g, "_");
  if (new URL(request.url).searchParams.get("formato") === "tiff") {
    if (!file.mime.startsWith("image/")) {
      return new Response(
        "Só uma imagem (foto ou digitalização) vira TIFF aqui. Para um PDF digitalizado, digitalize de novo como imagem ou use a imagem gerada da ficha.",
        {
          status: 422,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        },
      );
    }
    const tif = await imageToBwTiff(new Uint8Array(bytes));
    return new Response(new Uint8Array(tif), {
      headers: {
        "Content-Type": "image/tiff",
        "Content-Disposition": `attachment; filename="${safe.replace(/\.[^.]+$/, "")}.tif"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mime || "application/octet-stream",
      "Content-Disposition": `inline; filename="${safe}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
