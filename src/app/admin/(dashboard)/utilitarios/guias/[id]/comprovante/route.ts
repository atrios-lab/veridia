import { extname } from "node:path";
import { can } from "@/core/auth/roles.ts";
import { getSession } from "@/lib/session.ts";
import { getGuideStatus, receiptOf } from "@/lib/tax-guide-status.ts";
import { getTenant } from "@/lib/tenant.ts";
import { readStoredFile } from "@/lib/uploads.ts";
import { contentDisposition } from "../../../../documento/handle-document.ts";

export const runtime = "nodejs";

const READABLE = /^(application\/pdf|image\/)/;

/**
 * The comprovante of payment attached to a guia (or one from its history,
 * by `?arquivo=`), for the panel only. The stored path never reaches the
 * browser; the session is the credential.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "guides.manage", session.user.permissions)
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const { id } = await params;
  const tenant = await getTenant();
  const record = await getGuideStatus(tenant.slug, id);
  const file = receiptOf(
    record,
    new URL(request.url).searchParams.get("arquivo"),
  );
  if (!file) return new Response("Não encontrado", { status: 404 });
  const bytes = await readStoredFile(file.path);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": contentDisposition(
        READABLE.test(file.mimeType) ? "inline" : "attachment",
        `${file.displayName}${extname(file.storedName)}`,
      ),
      "Cache-Control": "private, no-store",
    },
  });
}
