import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { livePublications } from "@/lib/publications.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * The file attached to a publication: the signed edital, or the image or
 * PDF that goes with a notice. GET and no key: what the office publishes is
 * public, and publicity is the point of publishing it.
 *
 * No section gate, unlike the `/editais` page: a notice is home content and
 * an office without the editais section still publishes them, with their
 * attachment. What it does check is that the publication is live right now:
 * the file is fetched out of `livePublications`, not by id, so a draft, a
 * scheduled one, an expired one or an archived one answers 404 even to
 * someone who knows the identifier. Same rule the office's own screen
 * enforces.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const tenant = await getTenant();
  const { id } = await params;

  const publication = (await livePublications(tenant.slug)).find(
    (row) => row.id === id,
  );
  if (!publication?.attachmentPath || !publication.attachmentStoredName) {
    return new Response("Não encontrado", { status: 404 });
  }

  // In the deploy the file is a public blob: send the browser there instead
  // of piping the bytes through this function, whose response is capped
  // around 4.5 MB (a scanned PDF or a phone photo is often more, and the
  // image or PDF simply did not show). The liveness check above still runs
  // on every request; `no-store` keeps any cache from answering it after
  // the exit date.
  if (publication.attachmentPath.startsWith("http")) {
    return new Response(null, {
      status: 307,
      headers: {
        Location: publication.attachmentPath,
        "Cache-Control": "no-store",
      },
    });
  }

  // Development: the file is on disk, and small enough to send ourselves.
  const bytes = await readFile(publication.attachmentPath);

  // The title is the published act's own wording, so it is what the citizen
  // should find in their downloads folder. It is also operator-typed prose:
  // "nº", "ã", an em dash, and a header is a ByteString: anything above
  // U+00FF throws. RFC 5987 is how a real name survives, with an ASCII
  // fallback for whatever cannot read it.
  const extension = extname(publication.attachmentStoredName);
  const name =
    publication.title.replace(/[\\/:*?"<>|]/g, "-").slice(0, 120) + extension;
  const ascii = name.normalize("NFKD").replace(/[^\x20-\x7E]/g, "");

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": publication.attachmentMimeType ?? "application/pdf",
      // Inline: a publication is read (or looked at), not filed away.
      "Content-Disposition": `inline; filename="${ascii || `publicacao${extension}`}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}
