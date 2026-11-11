import { and, eq } from "drizzle-orm";
import { contentDisposition } from "@/app/admin/(dashboard)/documento/handle-document.ts";
import { db } from "@/db/index.ts";
import { auditNotificationFiles } from "@/db/schema.ts";
import { findNotificationWith } from "@/lib/audit-trail.ts";
import { readStoredFile } from "@/lib/uploads.ts";
import { auditAccess } from "../../access.ts";

export const runtime = "nodejs";

/** An image or file of a notification: its evidence or its answer. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const access = await auditAccess();
  if (!access) return new Response("Não encontrado", { status: 404 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return new Response("Não encontrado", { status: 404 });
  const [file] = await db
    .select()
    .from(auditNotificationFiles)
    .where(
      and(
        eq(auditNotificationFiles.tenantSlug, access.tenant.slug),
        eq(auditNotificationFiles.id, id),
      ),
    )
    .limit(1);
  if (!file) return new Response("Não encontrado", { status: 404 });
  const view = await findNotificationWith(
    db,
    access.tenant.slug,
    file.notificationId,
  );
  if (
    !view ||
    !(access.manager || view.targetUserId === access.session.user.id)
  ) {
    return new Response("Não encontrado", { status: 404 });
  }
  const extension = file.storedName.includes(".")
    ? file.storedName.slice(file.storedName.lastIndexOf("."))
    : "";
  return new Response(new Uint8Array(await readStoredFile(file.path)), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": contentDisposition(
        "inline",
        `${file.displayName}${extension}`,
      ),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
