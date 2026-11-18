import { isSectionEnabled } from "@/core/tenant/gating.ts";
import { db } from "@/db/index.ts";
import { staffFileWith } from "@/lib/team.ts";
import { getTenant } from "@/lib/tenant.ts";
import { readStoredFile } from "@/lib/uploads.ts";

/**
 * A person's photo for the site: only for someone marked "Mostrar no site",
 * with the image authorization recorded. Anything else is "not found", so a
 * withdrawn authorization takes the photo off at once.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const tenant = await getTenant();
  if (!isSectionEnabled(tenant, "equipe")) {
    return new Response("Não encontrado.", { status: 404 });
  }
  const { id } = await params;
  const file = await staffFileWith(db, tenant.slug, id, "photo", {
    publicOnly: true,
  }).catch(() => null);
  if (!file) return new Response("Não encontrado.", { status: 404 });
  try {
    const bytes = await readStoredFile(file.path);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": file.mime,
        // Short, so withdrawing the authorization is felt within minutes.
        "Cache-Control": "public, max-age=300, s-maxage=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Arquivo indisponível.", { status: 404 });
  }
}
