import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { getCertidaoWith } from "@/lib/rcpn-certidao.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { readStoredFile } from "@/lib/uploads.ts";

export const runtime = "nodejs";

/** The signed certidão attached by the office. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "rcpn.certidao", session.user.permissions)
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const row = await getCertidaoWith(db, tenant.slug, (await params).id);
  if (!row?.attachmentPath) {
    return new Response("Não encontrada", { status: 404 });
  }
  const name = row.attachmentName ?? "certidao";
  const type = /\.pdf$/i.test(name)
    ? "application/pdf"
    : /\.png$/i.test(name)
      ? "image/png"
      : /\.jpe?g$/i.test(name)
        ? "image/jpeg"
        : "application/octet-stream";
  return new Response(
    new Uint8Array(await readStoredFile(row.attachmentPath)),
    {
      headers: {
        "Content-Type": type,
        "Content-Disposition": `inline; filename="${name.replace(/[^\w.-]+/g, "_")}"`,
        "Cache-Control": "private, no-store",
      },
    },
  );
}
