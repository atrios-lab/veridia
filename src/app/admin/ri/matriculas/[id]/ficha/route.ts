import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { renderingFor } from "@/lib/pdf.ts";
import { fichaLegalPdfWith } from "@/lib/ri-books.ts";
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
  const mode = new URL(request.url).searchParams.get("assinatura");
  // The ficha as the model annexed to the Lei nº 6.015/1973 (decision of
  // 26/11/2026). For the assinador, no rule to sign by hand.
  const ficha = await fichaLegalPdfWith(db, tenant, (await params).id, {
    signer: mode !== "digital",
    withImage: mode === "imagem",
  });
  if (!ficha) return new Response("Não encontrado", { status: 404 });
  const pdf = ficha.bytes;
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
