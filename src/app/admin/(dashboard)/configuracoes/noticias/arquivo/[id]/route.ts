import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { newsFileWith } from "@/lib/news.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { readStoredFile } from "@/lib/uploads.ts";

/**
 * A file of a post for who edits the board: a photo or the PDF, whatever the
 * site shows (to preview a draft or a photo without the authorisation).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "news.edit", session.user.permissions)
  ) {
    return new Response("Não encontrado.", { status: 404 });
  }
  const { id } = await params;
  const tenant = await getTenant();
  const file = await newsFileWith(db, tenant.slug, id, { publicOnly: false });
  if (!file) return new Response("Não encontrado.", { status: 404 });
  try {
    const bytes = await readStoredFile(file.path);
    const name = file.name.replace(/[^\w.-]+/g, "_");
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": file.mime,
        "Content-Disposition": `inline; filename="${name}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Arquivo indisponível.", { status: 404 });
  }
}
