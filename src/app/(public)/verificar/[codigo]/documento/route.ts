import { db } from "@/db/index.ts";
import { isVerifyRateLimited } from "@/lib/rate-limit.ts";
import { downloadName, pdfResponse } from "@/lib/signature/documents.ts";
import { findSignedDocumentWith } from "@/lib/signing.ts";
import { getTenant } from "@/lib/tenant.ts";
import { readStoredFile } from "@/lib/uploads.ts";

export const runtime = "nodejs";

/** The signed PDF, for whoever holds the code, while its six months last. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> },
): Promise<Response> {
  if (await isVerifyRateLimited(request.headers)) {
    return new Response("Muitas consultas seguidas. Espere alguns minutos.", {
      status: 429,
    });
  }
  const tenant = await getTenant();
  const { codigo } = await params;
  const view = await findSignedDocumentWith(db, tenant.slug, { code: codigo });
  if (!view) return new Response("Não encontrado", { status: 404 });
  if (!view.filePath) {
    return new Response("O arquivo assinado já saiu do sistema.", {
      status: 410,
    });
  }
  return pdfResponse(
    await readStoredFile(view.filePath),
    downloadName(view.title, "assinado"),
  );
}
