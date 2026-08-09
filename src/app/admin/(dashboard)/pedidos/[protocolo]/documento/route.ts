import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { can } from "@/core/auth/roles.ts";
import { getAttachment } from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * GET, not POST like the public download: the admin is already
 * authenticated by session cookie, there's no access key to keep out of a
 * log line.
 */
export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "requests.manage")) {
    return new Response("Não autorizado", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const requestId = searchParams.get("requestId") ?? "";
  const attachmentId = searchParams.get("attachmentId") ?? "";

  const tenant = await getTenant();
  const attachment = await getAttachment(tenant.slug, requestId, attachmentId);
  if (!attachment) return new Response("Não encontrado", { status: 404 });

  const bytes = attachment.path.startsWith("http")
    ? Buffer.from(await (await fetch(attachment.path)).arrayBuffer())
    : await readFile(attachment.path);

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `attachment; filename="${attachment.displayName}${extname(attachment.storedName)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
