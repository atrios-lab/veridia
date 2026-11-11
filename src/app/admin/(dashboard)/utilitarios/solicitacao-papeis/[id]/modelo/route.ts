import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import {
  findOrderWith,
  findSupplierWith,
  getOfficeOrderDataWith,
  orderNumber,
  PaperOrderError,
  renderOrderModel,
} from "@/lib/paper-orders.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/** The supplier's own Word form, filled with this order. */
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
  const supplier = await findSupplierWith(db, tenant.slug, row.supplierId);
  if (!supplier?.modelPath) {
    return new Response("Esta empresa não tem modelo de formulário.", {
      status: 404,
    });
  }
  try {
    const docx = await renderOrderModel(
      tenant,
      row,
      { path: supplier.modelPath },
      await getOfficeOrderDataWith(db, tenant),
    );
    return new Response(new Uint8Array(docx), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="pedido-${orderNumber(row).replace("/", "-")}-modelo-da-empresa.docx"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof PaperOrderError) {
      return new Response(error.message, { status: 422 });
    }
    throw error;
  }
}
