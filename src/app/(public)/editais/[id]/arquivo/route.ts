import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { livePublications } from "@/lib/publications.ts";
import { getTenant } from "@/lib/tenant.ts";
import { requireSection } from "../../../_lib/section.ts";

export const runtime = "nodejs";

/**
 * The edital's own document. GET and no key: an edital is a public act, and
 * publicity is the point of publishing it.
 *
 * What it does check is that the publication is live right now — the file is
 * fetched out of `livePublications`, not by id, so a draft, a scheduled one,
 * an expired one or an archived one answers 404 even to someone who knows the
 * identifier. Same rule the office's own screen enforces.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  await requireSection("editais");
  const tenant = await getTenant();
  const { id } = await params;

  const publication = (await livePublications(tenant.slug)).find(
    (row) => row.id === id,
  );
  if (!publication?.attachmentPath || !publication.attachmentStoredName) {
    return new Response("Não encontrado", { status: 404 });
  }

  const bytes = publication.attachmentPath.startsWith("http")
    ? Buffer.from(await (await fetch(publication.attachmentPath)).arrayBuffer())
    : await readFile(publication.attachmentPath);

  // The title is the published act's own wording, so it is what the citizen
  // should find in their downloads folder. It is also operator-typed prose —
  // "nº", "ã", an em dash — and a header is a ByteString: anything above
  // U+00FF throws. RFC 5987 is how a real name survives, with an ASCII
  // fallback for whatever cannot read it.
  const extension = extname(publication.attachmentStoredName);
  const name =
    publication.title.replace(/[\\/:*?"<>|]/g, "-").slice(0, 120) + extension;
  const ascii = name.normalize("NFKD").replace(/[^\x20-\x7E]/g, "");

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": publication.attachmentMimeType ?? "application/pdf",
      // Inline: an edital is read, not filed away.
      "Content-Disposition": `inline; filename="${ascii || `edital${extension}`}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}
