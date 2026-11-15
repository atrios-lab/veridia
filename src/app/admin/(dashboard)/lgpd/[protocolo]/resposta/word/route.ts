import { renderDocumentDocx } from "@/lib/guide-files.ts";
import { NO_TEXT, replyDocumentFor } from "../_build.ts";

export const runtime = "nodejs";

/** The answer to the titular as a Word file, to edit or attach. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ protocolo: string }> },
): Promise<Response> {
  const found = await replyDocumentFor((await params).protocolo);
  if (found.status === 403)
    return new Response("Não autorizado", { status: 403 });
  if (found.status === 404)
    return new Response("Não encontrado", { status: 404 });
  if (found.status === 409) return new Response(NO_TEXT, { status: 409 });
  const docx = await renderDocumentDocx(found.tenant, found.document);
  return new Response(new Uint8Array(docx), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="resposta-${found.protocol}.docx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
