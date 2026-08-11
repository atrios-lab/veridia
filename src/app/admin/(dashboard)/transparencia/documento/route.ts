import { readFile } from "node:fs/promises";
import { can } from "@/core/auth/roles.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { getDocument } from "@/lib/transparency.ts";

export const runtime = "nodejs";

/**
 * Serves a transparency document to the panel, in any state. GET and
 * session-gated: the operator is already authenticated, and this is how they
 * proof a draft before publishing it. The public route serves published ones
 * only: this one exists precisely to show what the public one will not.
 */
export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "content.edit")) {
    return new Response("Não autorizado", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") ?? "";
  const tenant = await getTenant();
  const doc = await getDocument(tenant.slug, id);
  if (!doc) return new Response("Não encontrado", { status: 404 });

  const bytes = doc.filePath.startsWith("http")
    ? Buffer.from(await (await fetch(doc.filePath)).arrayBuffer())
    : await readFile(doc.filePath);

  // The title is what the operator should recognise in a new tab, and it is
  // their own prose: RFC 5987 is how "ã", "nº" and the like survive a header.
  const name = `${doc.title.replace(/[\\/:*?"<>|]/g, "-").slice(0, 120)}.pdf`;
  const ascii = name.normalize("NFKD").replace(/[^\x20-\x7E]/g, "");

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.fileMimeType,
      "Content-Disposition": `inline; filename="${ascii || "documento.pdf"}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
