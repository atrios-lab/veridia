import { can } from "@/core/auth/roles.ts";
import { buildOficio } from "@/core/titularidade/documents.ts";
import { db } from "@/db/index.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { getIssSettings } from "@/lib/iss-declarations.ts";
import { renderDocument, renderingFor } from "@/lib/pdf.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { getFilingWith } from "@/lib/title-transfers.ts";

export const runtime = "nodejs";

/** The month's ofício to the SEMUT, to print or to sign digitally. */
async function handle(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(
      session.user.role ?? "",
      "titularidade.manage",
      session.user.permissions,
    )
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const filing = await getFilingWith(db, tenant.slug, (await params).id);
  if (!filing) return new Response("Não encontrado", { status: 404 });
  const pdf = await renderDocument(
    buildOficio(tenant, {
      number: filing.number,
      competence: filing.competence,
      transfers: filing.transfers,
      settings: await getIssSettings(tenant),
      issuedOn: filing.issuedOn,
    }),
    await brandFor(tenant),
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="oficio-titularidade-${filing.number.replace("/", "-")}.pdf"`,
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
