import { readFile } from "node:fs/promises";
import { can } from "@/core/auth/roles.ts";
import { attachmentServable } from "@/core/publications/attachment-retention.ts";
import { today } from "@/lib/office-config.ts";
import {
  getPublication,
  publicationAttachmentStatus,
} from "@/lib/publications.ts";
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
  request: Request,
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
  // Past its 30 days and off the site: gone, even if the cleanup
  // (run when the list opens, see purgeExpiredAttachments) has not reached it yet.
  if (!attachmentServable(publicationAttachmentStatus(publication, today()))) {
    return new Response("Arquivo apagado pela regra de 30 dias", {
      status: 410,
    });
  }
  // "Baixar o arquivo": the office saving its own copy to its own cloud.
  const download = new URL(request.url).searchParams.has("baixar");

  // In the deploy the file is a blob: send the browser there, since a
  // function's response is capped around 4.5 MB (see the public route).
  if (publication.attachmentPath.startsWith("http")) {
    return new Response(null, {
      status: 307,
      headers: {
        // Vercel Blob answers `?download=1` with an attachment disposition.
        Location: download
          ? `${publication.attachmentPath}?download=1`
          : publication.attachmentPath,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const bytes = await readFile(publication.attachmentPath);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": publication.attachmentMimeType ?? "application/pdf",
      "Content-Disposition": download ? "attachment" : "inline",
      "Cache-Control": "private, no-store",
    },
  });
}
