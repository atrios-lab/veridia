import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { findLotWith } from "@/lib/security-paper.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { readStoredFile } from "@/lib/uploads.ts";

export const runtime = "nodejs";

/** The lot's nota fiscal, as scanned, to read. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(
      session.user.role ?? "",
      "security-paper.manage",
      session.user.permissions,
    )
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const lot = await findLotWith(db, tenant.slug, (await params).id);
  if (!lot?.invoicePath) {
    return new Response("Nenhuma nota anexada", { status: 404 });
  }
  const bytes = await readStoredFile(lot.invoicePath);
  const pdf = bytes.subarray(0, 4).toString() === "%PDF";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": pdf ? "application/pdf" : "application/octet-stream",
      "Content-Disposition": `${pdf ? "inline" : "attachment"}; filename="nota-fiscal-papel-seguranca${pdf ? ".pdf" : ""}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
