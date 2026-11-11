import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { getSession } from "@/lib/session.ts";
import { downloadName, pdfResponse } from "@/lib/signature/documents.ts";
import { findSignedDocumentWith } from "@/lib/signing.ts";
import { getTenant } from "@/lib/tenant.ts";
import { readStoredFile } from "@/lib/uploads.ts";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "signer.use", session.user.permissions)
  ) {
    return new Response("Não encontrado", { status: 404 });
  }
  const tenant = await getTenant();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return new Response("Não encontrado", { status: 404 });
  const view = await findSignedDocumentWith(db, tenant.slug, { id });
  if (!view) return new Response("Não encontrado", { status: 404 });
  if (!view.filePath)
    return new Response(
      view.removedAt ? "Documento excluído da lista" : "Arquivo expirado",
      { status: 410 },
    );
  // ?abrir=1: opens in the browser, to read or print again.
  const inline = new URL(request.url).searchParams.get("abrir") === "1";
  return pdfResponse(
    await readStoredFile(view.filePath),
    downloadName(view.title, "assinado"),
    inline,
  );
}
