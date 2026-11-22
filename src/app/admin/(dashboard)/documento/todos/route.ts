import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import {
  markRequestFilesSavedWith,
  zipRequestFilesWith,
} from "@/lib/request-files-due.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { contentDisposition } from "../handle-document.ts";

export const runtime = "nodejs";

/**
 * Every file of a protocol still stored, in one ZIP: "Baixar tudo" of the
 * reminder before the files are deleted. Downloading them counts as saving
 * them, so the reminder stops for this protocol (the audit says how).
 */
export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  const role = session?.user.role ?? "";
  const granted = session?.user.permissions;
  if (
    !session ||
    !(
      can(role, "requests.manage", granted) ||
      can(role, "channels.manage", granted)
    )
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const requestId = new URL(request.url).searchParams.get("pedido") ?? "";
  const tenant = await getTenant();
  const zip = await zipRequestFilesWith(db, tenant.slug, requestId, today());
  if (!zip) {
    return new Response("Este protocolo não tem mais arquivos para baixar.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  await markRequestFilesSavedWith(
    db,
    tenant.slug,
    requestId,
    session.user.id,
    "download",
  );
  return new Response(new Uint8Array(zip.bytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": contentDisposition(
        "attachment",
        `Arquivos ${zip.protocolNumber}.zip`,
      ),
      "Cache-Control": "private, no-store",
    },
  });
}
