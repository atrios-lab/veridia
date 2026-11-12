import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import {
  findOrderWith,
  getOfficeOrderDataWith,
  orderNumber,
  renderOrderPdf,
} from "@/lib/paper-orders.ts";
import { renderingFor } from "@/lib/pdf.ts";
import { getSession } from "@/lib/session.ts";
import { getGuideSettings } from "@/lib/tax-guides.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/** The order as a PDF, in the supplier's pattern, to print or sign. */
async function handle(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(
      session.user.role ?? "",
      "paper-orders.manage",
      session.user.permissions,
    )
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const row = await findOrderWith(db, tenant.slug, (await params).id);
  if (!row) return new Response("Não encontrado", { status: 404 });
  const pdf = await renderOrderPdf(
    tenant,
    row,
    await getOfficeOrderDataWith(db, tenant),
    (await getGuideSettings(tenant)).signers,
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="pedido-${orderNumber(row).replace("/", "-")}.pdf"`,
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
