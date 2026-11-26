import { can } from "@/core/auth/roles.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { renderDocument, renderingFor } from "@/lib/pdf.ts";
import { noteDocumentFor } from "@/lib/ri-docs.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * The nota devolutiva in PDF: to print and sign by hand, with the signer's
 * image (`?assinatura=imagem`) or for the assinador (`?assinatura=digital`).
 */
async function handle(
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
  const withImage =
    new URL(request.url).searchParams.get("assinatura") === "imagem";
  const note = await noteDocumentFor(tenant, (await params).id, withImage);
  if (!note) return new Response("Não encontrado", { status: 404 });
  const pdf = await renderDocument(note.document, await brandFor(tenant));
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="nota-devolutiva-${note.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export function GET(...args: Parameters<typeof handle>) {
  return renderingFor(args[0], () => handle(...args));
}
