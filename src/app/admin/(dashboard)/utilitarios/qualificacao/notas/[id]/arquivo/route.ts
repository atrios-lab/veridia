import { can } from "@/core/auth/roles.ts";
import { buildNote, buildPositive } from "@/core/qualificacao/documents.ts";
import { db } from "@/db/index.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { renderDocument, renderingFor } from "@/lib/pdf.ts";
import { getNoteWith } from "@/lib/qualificacao.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/** The note as issued, to print or to sign digitally. */
async function handle(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(
      session.user.role ?? "",
      "qualificacao.manage",
      session.user.permissions,
    )
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const note = await getNoteWith(db, tenant.slug, (await params).id);
  if (!note) return new Response("Não encontrado", { status: 404 });
  const input = {
    number: note.number,
    data: note.snapshot,
    issuedOn: note.issuedOn,
    signer: note.signer,
  };
  const document =
    note.kind === "positiva"
      ? buildPositive(tenant, input)
      : buildNote(tenant, { ...input, roundIndex: note.roundIndex });
  const pdf = await renderDocument(document, await brandFor(tenant));
  const name = `${note.kind === "positiva" ? "qualificacao-positiva" : "nota-devolutiva"}-${note.number.replace("/", "-")}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/**
 * "Assinar digitalmente" asks for the version without the line to sign by
 * hand (`?assinatura=digital`); printing gets the line.
 */
export function GET(...args: Parameters<typeof handle>) {
  return renderingFor(args[0], () => handle(...args));
}
