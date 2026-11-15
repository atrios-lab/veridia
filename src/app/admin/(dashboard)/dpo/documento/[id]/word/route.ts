import { renderDocumentDocx } from "@/lib/guide-files.ts";
import { chatDocumentFor } from "../_build.ts";

export const runtime = "nodejs";

/** The document drafted with the Assistente do DPO, as a Word file. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const found = await chatDocumentFor((await params).id);
  if (found.status === 403)
    return new Response("Não autorizado", { status: 403 });
  if (found.status === 404)
    return new Response("Não encontrado", { status: 404 });
  const docx = await renderDocumentDocx(found.tenant, found.document);
  return new Response(new Uint8Array(docx), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition":
        'attachment; filename="documento-encarregado.docx"',
      "Cache-Control": "private, no-store",
    },
  });
}
