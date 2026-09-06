import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { can } from "@/core/auth/roles.ts";
import { getIntake } from "@/lib/compliance.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

const READABLE = /^(application\/pdf|image\/)/;

/**
 * Serves one of the intake's files to the panel. Same shape as
 * /admin/documento: the stored path never reaches the browser, the session
 * is the credential, and what the browser can render opens inline.
 */
export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "content.edit")) {
    return new Response("Não autorizado", { status: 403 });
  }

  const id = new URL(request.url).searchParams.get("id") ?? "";
  const tenant = await getTenant();
  const intake = await getIntake(tenant.slug);
  const file = intake.attachments.find((a) => a.id === id);
  if (!file) return new Response("Não encontrado", { status: 404 });

  const bytes = file.path.startsWith("http")
    ? Buffer.from(await (await fetch(file.path)).arrayBuffer())
    : await readFile(file.path);

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `${READABLE.test(file.mimeType) ? "inline" : "attachment"}; filename="${file.displayName}${extname(file.storedName)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
