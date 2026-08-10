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
 *
 * Not under a protocol segment: the attachment is found by request and
 * attachment id alone, and the same handler serves every section of the panel
 * that shows a file — a service request, an LGPD requirement, whatever comes
 * next.
 */
/** Types a registrar reads on screen; anything else is handed over to save. */
const READABLE = /^(application\/pdf|image\/)/;

export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  const role = session?.user.role ?? "";
  // Either permission: the same file hangs off a service request (requests) or
  // an LGPD requirement (channels), and the two screens are gated differently.
  // Both roles hold both today, so demanding only one is a trap set for the
  // day a channels-only role exists.
  if (
    !session ||
    !(can(role, "requests.manage") || can(role, "channels.manage"))
  ) {
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

  // Inline for what the browser can render: checking four attachments should
  // not leave four copies in Downloads, and reading the file is how the office
  // decides whether the requirement was met.
  const disposition = READABLE.test(attachment.mimeType)
    ? "inline"
    : "attachment";

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `${disposition}; filename="${attachment.displayName}${extname(attachment.storedName)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
