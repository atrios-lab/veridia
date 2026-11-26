import { can } from "@/core/auth/roles.ts";
import { isoDate } from "@/core/ri/property.ts";
import { db } from "@/db/index.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { renderDocument, renderingFor } from "@/lib/pdf.ts";
import { protocolDayDocumentFor } from "@/lib/ri-books.ts";
import { officeToday } from "@/lib/ri-protocols.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * The Protocolo of one day with its encerramento (Lei nº 6.015/1973, art.
 * 184: "O Protocolo será encerrado diariamente"), `?data=aaaa-mm-dd`.
 */
async function handle(request: Request): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "ri.view", session.user.permissions)
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const query = new URL(request.url).searchParams;
  const day = isoDate(query.get("data") ?? "") ?? officeToday();
  const pdf = await renderDocument(
    await protocolDayDocumentFor(
      db,
      tenant,
      day,
      query.get("assinatura") === "imagem",
    ),
    await brandFor(tenant),
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="protocolo-${day}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export function GET(request: Request) {
  return renderingFor(request, () => handle(request));
}
