import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { findEntryWith } from "@/lib/daily-book.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { readStoredFile } from "@/lib/uploads.ts";

export const runtime = "nodejs";

/** The receipt attached to a line of the book (art. 191-A, § 3º). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "daily-book.manage", session.user.permissions)
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const row = await findEntryWith(db, tenant.slug, (await params).id);
  if (!row?.attachmentPath)
    return new Response("Sem comprovante", { status: 404 });
  const bytes = await readStoredFile(row.attachmentPath);
  const pdf = bytes.subarray(0, 4).toString() === "%PDF";
  const png = bytes.subarray(1, 4).toString() === "PNG";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": pdf
        ? "application/pdf"
        : png
          ? "image/png"
          : "image/jpeg",
      "Content-Disposition": `inline; filename="comprovante${pdf ? ".pdf" : png ? ".png" : ".jpg"}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
