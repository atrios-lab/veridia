import { readFile } from "node:fs/promises";
import { publishedDocuments } from "@/lib/transparency.ts";
import { requireSection } from "../../../_lib/section.ts";

export const runtime = "nodejs";

/**
 * A published transparency document. GET and no key: a fee table is a public
 * act. It is fetched out of `publishedDocuments`, not by id alone, so a draft
 * or an unpublished one answers 404 even to someone who knows the identifier -
 * the same rule the panel's own view route does not apply, on purpose.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const tenant = await requireSection("transparencia");
  const { id } = await params;

  const doc = (await publishedDocuments(tenant.slug)).find((d) => d.id === id);
  if (!doc) return new Response("Não encontrado", { status: 404 });

  const bytes = doc.filePath.startsWith("http")
    ? Buffer.from(await (await fetch(doc.filePath)).arrayBuffer())
    : await readFile(doc.filePath);

  // The title is what the citizen should find in their downloads. It is
  // operator-typed prose, so RFC 5987 carries the accents a header cannot.
  const name = `${doc.title.replace(/[\\/:*?"<>|]/g, "-").slice(0, 120)}.pdf`;
  const ascii = name.normalize("NFKD").replace(/[^\x20-\x7E]/g, "");

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.fileMimeType,
      "Content-Disposition": `inline; filename="${ascii || "documento.pdf"}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}
