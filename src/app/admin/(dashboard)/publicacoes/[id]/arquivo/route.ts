import { readFile } from "node:fs/promises";
import { can } from "@/core/auth/roles.ts";
import { getPublication } from "@/lib/publications.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * A publication's file for the panel, in any state: draft, scheduled,
 * archived. The public route serves only what is live; this is how the
 * office checks, months later, which document an archived edital carried.
 * The session is the credential, and the row must belong to this office.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "content.edit")) {
    return new Response("Não autorizado", { status: 403 });
  }

  const { id } = await params;
  const tenant = await getTenant();
  const publication = await getPublication(tenant.slug, id);
  if (!publication?.attachmentPath) {
    return new Response("Não encontrado", { status: 404 });
  }

  // In the deploy the file is a blob: send the browser there, since a
  // function's response is capped around 4.5 MB (see the public route).
  if (publication.attachmentPath.startsWith("http")) {
    return new Response(null, {
      status: 307,
      headers: {
        Location: publication.attachmentPath,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const bytes = await readFile(publication.attachmentPath);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": publication.attachmentMimeType ?? "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
    },
  });
}
