import { buildNote, buildPositive } from "@/core/qualificacao/documents.ts";
import { db } from "@/db/index.ts";
import { renderDocumentDocx } from "@/lib/guide-files.ts";
import { getNoteWith } from "@/lib/qualificacao.ts";
import { getTenant } from "@/lib/tenant.ts";
import { mayDownloadNotes } from "../../../_access.ts";

export const runtime = "nodejs";

/** The note as a Word file, to edit or attach. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!(await mayDownloadNotes())) {
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
  const docx = await renderDocumentDocx(tenant, document);
  const name = `${note.kind === "positiva" ? "qualificacao-positiva" : "nota-devolutiva"}-${note.number.replace("/", "-")}.docx`;
  return new Response(new Uint8Array(docx), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
