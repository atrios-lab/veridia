import { isSectionEnabled } from "@/core/tenant/gating.ts";
import { db } from "@/db/index.ts";
import { newsFileWith } from "@/lib/news.ts";
import { getTenant } from "@/lib/tenant.ts";
import { readStoredFile } from "@/lib/uploads.ts";

/**
 * A photo or the PDF of a post for the site: only of a post that is
 * published and not archived, the photos only with the image authorisation.
 * Anything else is "not found", so withdrawing the authorisation, taking a
 * file off or archiving the post closes it within minutes.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const tenant = await getTenant();
  if (!isSectionEnabled(tenant, "noticias")) {
    return new Response("Não encontrado.", { status: 404 });
  }
  const { id } = await params;
  const file = await newsFileWith(db, tenant.slug, id, {
    publicOnly: true,
  }).catch(() => null);
  if (!file) return new Response("Não encontrado.", { status: 404 });
  try {
    const bytes = await readStoredFile(file.path);
    const name = file.name.replace(/[^\w.-]+/g, "_");
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": file.mime,
        "Content-Disposition": `inline; filename="${name}"`,
        "Cache-Control": "public, max-age=300, s-maxage=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Arquivo indisponível.", { status: 404 });
  }
}
