import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { findMessageFileWith } from "@/lib/messages.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { readStoredFile } from "@/lib/uploads.ts";
import { contentDisposition } from "../../../documento/handle-document.ts";

export const runtime = "nodejs";

/** Opens in the browser what it can show (PDF, image, audio). */
const INLINE = /^(application\/pdf|image\/(jpeg|png|webp|gif)|audio\/)/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  const role = session?.user.role ?? "";
  if (!session || !can(role, "desk.access", session.user.permissions)) {
    return new Response("Não encontrado", { status: 404 });
  }
  const tenant = await getTenant();
  const { id } = await params;
  const file = await findMessageFileWith(db, tenant.slug, id, {
    id: session.user.id,
    oversight:
      role === "superadmin" ||
      can(role, "audit.manage", session.user.permissions),
  });
  if (!file) return new Response("Não encontrado", { status: 404 });
  const bytes = await readStoredFile(file.path);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": contentDisposition(
        INLINE.test(file.mimeType) ? "inline" : "attachment",
        file.name,
      ),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
