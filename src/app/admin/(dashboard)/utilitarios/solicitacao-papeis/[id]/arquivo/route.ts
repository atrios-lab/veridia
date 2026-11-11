import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import {
  findOrderWith,
  getOfficeOrderDataWith,
  orderNumber,
  renderOrderPdf,
} from "@/lib/paper-orders.ts";
import { getSession } from "@/lib/session.ts";
import { getGuideSettings } from "@/lib/tax-guides.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/** The order as a PDF, in the supplier's pattern, to print or sign. */
export async function GET(
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
