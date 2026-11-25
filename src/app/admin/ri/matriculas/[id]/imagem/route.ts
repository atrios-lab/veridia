import { can } from "@/core/auth/roles.ts";
import { fichaFor } from "@/lib/ri-docs.ts";
import { fichaTiff } from "@/lib/ri-tiff.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * The image of the matrícula for the ONR: black and white TIFF, 1 bit,
 * CCITT G4, 300 dpi, one page per folha (src/lib/ri-tiff.ts). With
 * `?assinatura=imagem`, the signer's image goes over the rule.
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
  const ficha = await fichaFor(tenant, (await params).id);
  if (!ficha) return new Response("Não encontrado", { status: 404 });
  const withImage =
    new URL(request.url).searchParams.get("assinatura") === "imagem";
  const tif = await fichaTiff(
    ficha.content,
    withImage ? ficha.signatureImage : null,
  );
  return new Response(new Uint8Array(tif), {
    headers: {
      "Content-Type": "image/tiff",
      "Content-Disposition": `attachment; filename="matricula-${ficha.number}.tif"`,
      "Cache-Control": "private, no-store",
    },
  });
}
