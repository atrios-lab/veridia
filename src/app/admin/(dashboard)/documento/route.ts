import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { handleDocumentWith } from "./handle-document.ts";

export const runtime = "nodejs";

/**
 * GET, not POST like the public download: the admin is already
 * authenticated by session cookie, there's no access key to keep out of a
 * log line.
 *
 * Not under a protocol segment: the attachment is found by request and
 * attachment id alone, and the same handler serves every section of the panel
 * that shows a file: a service request, an LGPD requirement, whatever comes
 * next.
 *
 * The actual work is `handleDocumentWith`, in its own file: this route only
 * resolves the session and the tenant. See handle-document.ts and
 * design.md, decision 8.
 */
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
  return handleDocumentWith(
    db,
    tenant,
    session.user.id,
    requestId,
    attachmentId,
  );
}
