import { can } from "@/core/auth/roles.ts";
import { getIssSettings } from "@/lib/iss-declarations.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { readStoredFile } from "@/lib/uploads.ts";

export const runtime = "nodejs";

/** The municipal law (or plano diretor) the holder attached, to read. */
export async function GET(): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "iss.manage", session.user.permissions)
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const settings = await getIssSettings(await getTenant());
  if (!settings.lawAttachment) {
    return new Response("Nenhuma lei anexada", { status: 404 });
  }
  const bytes = await readStoredFile(settings.lawAttachment.path);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="lei-municipal-iss.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}
