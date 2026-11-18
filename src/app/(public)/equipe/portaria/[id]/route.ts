import { isSectionEnabled } from "@/core/tenant/gating.ts";
import { db } from "@/db/index.ts";
import { staffFileWith } from "@/lib/team.ts";
import { getTenant } from "@/lib/tenant.ts";
import { readStoredFile } from "@/lib/uploads.ts";

/**
 * A person's portaria de nomeação, as a PDF: the Tabelião published it by
 * attaching it. Only for someone marked "Mostrar no site"; the Word is never
 * served here.
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
  const file = await staffFileWith(db, tenant.slug, id, "portaria", {
    publicOnly: true,
  }).catch(() => null);
  if (!file) return new Response("Não encontrado.", { status: 404 });
  try {
    const bytes = await readStoredFile(file.path);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="portaria.pdf"',
        "Cache-Control": "public, max-age=300, s-maxage=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Arquivo indisponível.", { status: 404 });
  }
}
