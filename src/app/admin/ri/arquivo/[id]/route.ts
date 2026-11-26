import { can } from "@/core/auth/roles.ts";
import { markdownSections, originalKind } from "@/core/ri/markdown-doc.ts";
import { officialName } from "@/core/tenant/identification.ts";
import { formatOfficeDate } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { renderDocument } from "@/lib/pdf.ts";
import { fileWith } from "@/lib/ri-files.ts";
import { imageToBwTiff } from "@/lib/ri-tiff.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { readStoredFile } from "@/lib/uploads.ts";

export const runtime = "nodejs";

/**
 * A file attached in the Registro de Imóveis, as it was sent (or its text
 * in Markdown, when only the text was kept: shown as a PDF rebuilt from
 * it, `?formato=md` for the Markdown itself); with
 * `?formato=tiff`, a scanned image as the ONR's black and white TIFF (G4).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "ri.view", session.user.permissions)
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const file = await fileWith(db, tenant.slug, (await params).id);
  if (!file) return new Response("Não encontrado", { status: 404 });
  const safe = file.name.replace(/[^\w.-]+/g, "_");
  // Kept only as Markdown: the original was discarded when it was read.
  if (!file.path) {
    const markdown =
      (file.reading as { markdown?: string } | null)?.markdown ?? "";
    const query = new URL(request.url).searchParams;
    if (query.get("formato") !== "md") {
      // Back as a PDF: the same text, the look rebuilt from the Markdown.
      const pdf = await renderDocument(
        {
          eyebrow: "Registro de Imóveis · documento guardado em texto",
          title: file.name.replace(/\.[^.]+$/, ""),
          subtitle: `Original em ${originalKind(file.mime, file.name)}, guardado só o texto em ${formatOfficeDate(file.createdAt)} (o arquivo foi descartado para não ocupar espaço)`,
          office: [officialName(tenant), tenant.subtitle],
          sections: markdownSections(markdown),
          signature: [],
          footer: `${officialName(tenant)} · ${tenant.legalFooter}`,
        },
        await brandFor(tenant),
      );
      return new Response(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `${query.get("baixar") === "1" ? "attachment" : "inline"}; filename="${safe.replace(/\.[^.]+$/, "")}.pdf"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    return new Response(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `inline; filename="${safe}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  const bytes = await readStoredFile(file.path);
  if (new URL(request.url).searchParams.get("formato") === "tiff") {
    if (!file.mime.startsWith("image/")) {
      return new Response(
        "Só uma imagem (foto ou digitalização) vira TIFF aqui. Para um PDF digitalizado, digitalize de novo como imagem ou use a imagem gerada da ficha.",
        {
          status: 422,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        },
      );
    }
    const tif = await imageToBwTiff(new Uint8Array(bytes));
    return new Response(new Uint8Array(tif), {
      headers: {
        "Content-Type": "image/tiff",
        "Content-Disposition": `attachment; filename="${safe.replace(/\.[^.]+$/, "")}.tif"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mime || "application/octet-stream",
      "Content-Disposition": `inline; filename="${safe}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
