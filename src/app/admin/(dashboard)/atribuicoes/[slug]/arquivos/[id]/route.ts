import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { getAttributionFileWith } from "@/lib/attribution-files.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { readStoredFile } from "@/lib/uploads.ts";

export const runtime = "nodejs";

/** Downloads a file sent to an attribution, as it came. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "attributions.view", session.user.permissions)
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const { slug, id } = await params;
  const row = await getAttributionFileWith(db, tenant.slug, id);
  if (!row || row.attribution !== slug) {
    return new Response("Não encontrado", { status: 404 });
  }
  return new Response(new Uint8Array(await readStoredFile(row.storedPath)), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${row.fileName.replace(/[^\w.-]+/g, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
