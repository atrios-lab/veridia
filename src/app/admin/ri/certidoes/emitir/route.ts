import sharp from "sharp";
import { can } from "@/core/auth/roles.ts";
import type { CertidaoKind } from "@/core/ri/certidao.ts";
import { custasNoteFrom } from "@/core/ri/closing-notes.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { renderDocumentDocx } from "@/lib/guide-files.ts";
import { renderDocument, renderingFor } from "@/lib/pdf.ts";
import { RiError } from "@/lib/ri.ts";
import { certidaoDocumentFor } from "@/lib/ri-certidoes.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

const KINDS: CertidaoKind[] = [
  "inteiro-teor",
  "onus",
  "resumo",
  "quesitos",
  "negativa",
];

const message = (text: string, status = 400) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><title>Certidão</title><body style="font-family:sans-serif;padding:24px"><p>${text.replace(/</g, "&lt;")}</p><p><a href="javascript:history.back()">Voltar</a></p></body>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

/**
 * Issues a certidão (decision of 26/11/2026): PDF ready to sign, or Word
 * for the office to adjust and paste the selo where it likes. The selo's
 * number and image come with each emission.
 */
async function handle(request: Request): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "ri.view", session.user.permissions)
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const form = await request.formData();
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const kind = get("tipo") as CertidaoKind;
  if (!KINDS.includes(kind)) return message("Escolha o tipo de certidão.");
  let image: Uint8Array | undefined;
  const file = form.get("seloImagem");
  if (file instanceof File && file.size > 0) {
    if (file.size > 3 * 1024 * 1024) {
      return message("A imagem do selo passa de 3 MB.");
    }
    try {
      // Word takes PNG; any photo or scan becomes one.
      image = new Uint8Array(
        await sharp(Buffer.from(await file.arrayBuffer()))
          .png()
          .toBuffer(),
      );
    } catch {
      return message("Não consegui ler a imagem do selo. Use PNG ou JPG.");
    }
  }
  try {
    const { document, fileName } = await certidaoDocumentFor(
      tenant,
      {
        kind,
        propertyId: get("matricula") || undefined,
        questions: get("quesitos")
          .split(/\r?\n/)
          .map((q) => q.trim())
          .filter(Boolean)
          .slice(0, 30),
        searched: { name: get("nome"), document: get("documento") },
        requester: get("requerente"),
        seal: { number: get("seloNumero"), image },
        withSignatureImage: get("assinatura") === "imagem",
        custas: custasNoteFrom(form.get("custas")),
      },
      { id: session.user.id },
    );
    if (get("formato") === "word") {
      const docx = await renderDocumentDocx(tenant, document);
      return new Response(new Uint8Array(docx), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="certidao-${fileName}.docx"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    const pdf = await renderDocument(document, await brandFor(tenant));
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="certidao-${fileName}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof RiError) return message(error.message);
    throw error;
  }
}

export function POST(...args: Parameters<typeof handle>) {
  return renderingFor(args[0], () => handle(...args));
}
