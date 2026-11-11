import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { photoPathOfWith } from "@/lib/messages.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { readStoredFile } from "@/lib/uploads.ts";

export const runtime = "nodejs";

/** A colleague's photo in the messenger: anyone of the same office. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "desk.access", session.user.permissions)
  ) {
    return new Response("Não encontrado", { status: 404 });
  }
  const tenant = await getTenant();
  const { userId } = await params;
  const path = await photoPathOfWith(db, tenant.slug, userId);
  if (!path) return new Response("Não encontrado", { status: 404 });
  const bytes = await readStoredFile(path);
  const type = /\.png$/i.test(path)
    ? "image/png"
    : /\.webp$/i.test(path)
      ? "image/webp"
      : /\.gif$/i.test(path)
        ? "image/gif"
        : "image/jpeg";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": type,
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
