import { brandFor } from "@/lib/document-brand.ts";
import { renderDocument, renderingFor } from "@/lib/pdf.ts";
import { chatDocumentFor } from "./_build.ts";

export const runtime = "nodejs";

/** The document drafted with the Assistente do DPO, to sign or print. */
async function handle(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const found = await chatDocumentFor((await params).id);
  if (found.status === 403)
    return new Response("Não autorizado", { status: 403 });
  if (found.status === 404)
    return new Response("Não encontrado", { status: 404 });
  const pdf = await renderDocument(
    found.document,
    await brandFor(found.tenant),
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="documento-encarregado.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}

/**
 * "Assinar digitalmente" asks for the version without the line to sign by
 * hand (`?assinatura=digital`); printing gets the line.
 */
export function GET(...args: Parameters<typeof handle>) {
  return renderingFor(args[0], () => handle(...args));
}
