import { can } from "@/core/auth/roles.ts";
import type { TeamFileKind } from "@/core/team/team.ts";
import { db } from "@/db/index.ts";
import { getSession } from "@/lib/session.ts";
import { staffFileWith } from "@/lib/team.ts";
import { getTenant } from "@/lib/tenant.ts";
import { readStoredFile } from "@/lib/uploads.ts";

const KINDS: readonly TeamFileKind[] = ["photo", "portaria", "word"];

/**
 * A team file for who edits the team: the photo, the portaria or the Word,
 * whatever the site shows. The Word is only ever served from here.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; kind: string }> },
): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "team.edit", session.user.permissions)
  ) {
    return new Response("Não encontrado.", { status: 404 });
  }
  const { id, kind } = await params;
  if (!KINDS.includes(kind as TeamFileKind)) {
    return new Response("Não encontrado.", { status: 404 });
  }
  const tenant = await getTenant();
  const file = await staffFileWith(db, tenant.slug, id, kind as TeamFileKind, {
    publicOnly: false,
  });
  if (!file) return new Response("Não encontrado.", { status: 404 });
  try {
    const bytes = await readStoredFile(file.path);
    const name = file.name.replace(/[^\w.-]+/g, "_");
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": file.mime,
        "Content-Disposition": `${kind === "word" ? "attachment" : "inline"}; filename="${name}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Arquivo indisponível.", { status: 404 });
  }
}
