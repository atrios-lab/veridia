import { db } from "@/db/index.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { renderDocument, renderingFor } from "@/lib/pdf.ts";
import { signerLines } from "@/lib/ri-books.ts";
import { foreignBookDocument, listForeignWith } from "@/lib/ri-foreign.ts";
import { getTenant } from "@/lib/tenant.ts";
import { canReadForeign } from "../_access.ts";

export const runtime = "nodejs";

/** The Livro de Cadastro de Aquisição por Estrangeiro, all assentos. */
export function GET(request: Request) {
  return renderingFor(request, async () => {
    if (!(await canReadForeign())) {
      return new Response("Não autorizado", { status: 403 });
    }
    const tenant = await getTenant();
    const rows = await listForeignWith(db, tenant.slug);
    const withImage =
      new URL(request.url).searchParams.get("assinatura") === "imagem";
    const pdf = await renderDocument(
      foreignBookDocument(tenant, rows, await signerLines(tenant, withImage)),
      await brandFor(tenant),
    );
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          'inline; filename="livro-aquisicao-estrangeiro.pdf"',
        "Cache-Control": "private, no-store",
      },
    });
  });
}
