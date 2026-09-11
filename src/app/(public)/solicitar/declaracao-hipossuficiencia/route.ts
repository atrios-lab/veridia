import { getActForTenant } from "@/core/acts/catalog.ts";
import { buildDeclaracao } from "@/core/request/declaracao.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { renderDocument } from "@/lib/pdf.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * The Anexo I do Provimento CGJ/TJRN n. 7/2026, blank, for whoever wants to
 * fill it by hand before coming in or before filing online (art. 2º §1º e
 * §4º): no pedido, no chave, no sessão. Only one document, even where the
 * eventual pedido would need two (a habilitação de casamento): without an
 * ato-alvo chosen yet, there is no way to know how many the person will
 * need, and a couple filling this in by hand copies the page themselves.
 */
export async function GET(request: Request): Promise<Response> {
  const tenant = await getTenant();
  const act = getActForTenant(tenant, "gratuidade-rcpn");
  if (!act) return new Response("Não encontrado", { status: 404 });

  const brand = await brandFor(
    tenant,
    `${new URL(request.url).origin}/protocolo`,
  );
  const bytes = await renderDocument(
    buildDeclaracao(tenant, act, undefined, 0),
    brand,
  );

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        'inline; filename="declaracao-hipossuficiencia.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}
