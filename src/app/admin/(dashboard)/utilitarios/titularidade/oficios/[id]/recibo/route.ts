import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { getFilingWith } from "@/lib/title-transfers.ts";
import { readStoredFile } from "@/lib/uploads.ts";

export const runtime = "nodejs";

/** The platform's receipt of delivery, as the office attached it. */
export async function GET(
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
  if (!filing?.receiptPath) {
    return new Response("Não encontrado", { status: 404 });
  }
  const name = filing.receiptName ?? "recibo";
  const type = /\.pdf$/i.test(name)
    ? "application/pdf"
    : /\.png$/i.test(name)
      ? "image/png"
      : /\.jpe?g$/i.test(name)
        ? "image/jpeg"
        : "application/octet-stream";
  return new Response(
    new Uint8Array(await readStoredFile(filing.receiptPath)),
    {
      headers: {
        "Content-Type": type,
        "Content-Disposition": `inline; filename="${name.replace(/[^\w.-]+/g, "_")}"`,
        "Cache-Control": "private, no-store",
      },
    },
  );
}
