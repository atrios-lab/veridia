import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { findSupplierWith } from "@/lib/paper-orders.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { readStoredFile } from "@/lib/uploads.ts";

export const runtime = "nodejs";

/** The supplier's form as it was uploaded, blank or not. */
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
  const row = await findSupplierWith(db, tenant.slug, (await params).id);
  if (!row?.modelPath) return new Response("Sem modelo", { status: 404 });
  const bytes = await readStoredFile(row.modelPath);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": 'attachment; filename="modelo-da-empresa.docx"',
      "Cache-Control": "private, no-store",
    },
  });
}
