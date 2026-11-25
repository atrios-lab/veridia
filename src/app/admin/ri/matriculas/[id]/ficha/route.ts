import { can } from "@/core/auth/roles.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { renderDocument, renderingFor } from "@/lib/pdf.ts";
import { fichaDocument, fichaFor } from "@/lib/ri-docs.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * The ficha of the matrícula in PDF, three ways (decision of 25/11/2026):
 * to print and sign by hand; "com a minha assinatura" (`?assinatura=imagem`,
 * the signer's image over the rule); or for the assinador
 * (`?assinatura=digital`, no rule, the note that it is signed with the
 * certificate).
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
  const ficha = await fichaFor(tenant, (await params).id);
  if (!ficha) return new Response("Não encontrado", { status: 404 });
  const withImage =
    new URL(request.url).searchParams.get("assinatura") === "imagem";
  const pdf = await renderDocument(
    fichaDocument(
      tenant,
      ficha.content,
      withImage ? ficha.signatureImage : null,
    ),
    await brandFor(tenant),
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="matricula-${ficha.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export function GET(...args: Parameters<typeof handle>) {
  return renderingFor(args[0], () => handle(...args));
}
