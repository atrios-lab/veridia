import { can } from "@/core/auth/roles.ts";
import { getIssSettings } from "@/lib/iss-declarations.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { readStoredFile } from "@/lib/uploads.ts";

export const runtime = "nodejs";

/**
 * What the holder attached to the configuration, to read: the municipal law
 * (or plano diretor), or with `?doc=portaria` the appointment of the mayor
 * and the secretary.
 */
export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "iss.manage", session.user.permissions)
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const settings = await getIssSettings(await getTenant());
  const portaria = new URL(request.url).searchParams.get("doc") === "portaria";
  const file = portaria
    ? settings.appointmentAttachment
    : settings.lawAttachment;
  if (!file) {
    return new Response("Nenhum arquivo anexado", { status: 404 });
  }
  const bytes = await readStoredFile(file.path);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${portaria ? "portaria" : "lei-municipal-iss"}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
