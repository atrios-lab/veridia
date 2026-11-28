import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { renderDocument, renderingFor } from "@/lib/pdf.ts";
import { bookToWord } from "@/lib/ri-book-word.ts";
import { termDocumentFor } from "@/lib/ri-books.ts";
import {
  printChoiceWith,
  signerLinesOf,
  stampRubric,
} from "@/lib/ri-signers.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * The termo de abertura (`?tipo=abertura`) or de encerramento
 * (`?tipo=encerramento`) of a book (Lei nº 6.015/1973, art. 4º). Who signs
 * (`?quem=`), the signature image (`?imagem=1`), the rubrica on the page
 * (`?rubrica=1`) and the digital signature (`?assinatura=digital`) go
 * together or apart; `?formato=word` for the Tabelião to adjust.
 */
async function handle(
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
  const query = new URL(request.url).searchParams;
  const kind =
    query.get("tipo") === "encerramento" ? "encerramento" : "abertura";
  const choice = await printChoiceWith(db, tenant, query);
  const term = await termDocumentFor(
    db,
    tenant,
    (await params).id,
    kind,
    choice.signature,
    signerLinesOf(choice),
  );
  if (!term) return new Response("Não encontrado", { status: 404 });
  if (query.get("formato") === "word") {
    const docx = await bookToWord(term.name, [
      { kind: "term", document: term.document },
    ]);
    return new Response(new Uint8Array(docx), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${term.name}.docx"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  let pdf: Uint8Array = new Uint8Array(
    await renderDocument(term.document, await brandFor(tenant)),
  );
  if (choice.rubric && choice.signer?.rubricImage) {
    pdf = await stampRubric(pdf, choice.signer.rubricImage);
  }
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${term.name}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export function GET(...args: Parameters<typeof handle>) {
  return renderingFor(args[0], () => handle(...args));
}
