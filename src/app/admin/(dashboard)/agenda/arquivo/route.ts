import { readFile } from "node:fs/promises";
import { can } from "@/core/auth/roles.ts";
import { findAppointmentAttachment } from "@/lib/appointments.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * A document a citizen sent ahead of an appointment, served to the panel:
 * session-gated, same permission as the agenda itself.
 */
export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "channels.manage")) {
    return new Response("Não autorizado", { status: 403 });
  }

  const id = new URL(request.url).searchParams.get("id") ?? "";
  const tenant = await getTenant();
  const file = await findAppointmentAttachment(tenant.slug, id);
  if (!file?.path) return new Response("Não encontrado", { status: 404 });

  const bytes = file.path.startsWith("http")
    ? Buffer.from(await (await fetch(file.path)).arrayBuffer())
    : await readFile(file.path);
  const name = file.displayName.replace(/[\\/:*?"<>|]/g, "-").slice(0, 120);
  const ascii = name.normalize("NFKD").replace(/[^\x20-\x7E]/g, "");

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename="${ascii || "documento"}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
