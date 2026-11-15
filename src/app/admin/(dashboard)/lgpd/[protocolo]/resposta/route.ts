import { brandFor } from "@/lib/document-brand.ts";
import { renderDocument, renderingFor } from "@/lib/pdf.ts";
import { NO_TEXT, replyDocumentFor } from "./_build.ts";

export const runtime = "nodejs";

/** The answer to the titular, to sign digitally or print and sign. */
async function handle(
  _request: Request,
  { params }: { params: Promise<{ protocolo: string }> },
): Promise<Response> {
  const found = await replyDocumentFor((await params).protocolo);
  if (found.status === 403)
    return new Response("Não autorizado", { status: 403 });
  if (found.status === 404)
    return new Response("Não encontrado", { status: 404 });
  if (found.status === 409) return new Response(NO_TEXT, { status: 409 });
  const pdf = await renderDocument(
    found.document,
    await brandFor(found.tenant),
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="resposta-${found.protocol}.pdf"`,
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
