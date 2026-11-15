import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { getSourceWith, sourceMarkdown } from "@/lib/knowledge.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

/** The source as it was kept, one Markdown file. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "knowledge.manage", session.user.permissions)
  ) {
    return new Response("Não encontrado.", { status: 404 });
  }
  const { id } = await params;
  const tenant = await getTenant();
  const source = await getSourceWith(db, tenant.slug, id);
  if (!source) return new Response("Não encontrado.", { status: 404 });
  const name =
    (source.meta.reference || source.meta.title)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 80) || "fonte";
  return new Response(sourceMarkdown(source), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}.md"`,
      "Cache-Control": "no-store",
    },
  });
}
