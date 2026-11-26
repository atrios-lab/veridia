import { can } from "@/core/auth/roles.ts";
import type { TransferKind } from "@/core/ri/transfer.ts";
import { db } from "@/db/index.ts";
import {
  TRANSFER_FORMATS,
  type TransferFormat,
  transferExportWith,
} from "@/lib/ri-transfer.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

const KINDS: readonly (TransferKind | "acervo")[] = [
  "matriculas",
  "atos",
  "pessoas",
  "indicador-real",
  "indicador-pessoal",
  "acervo",
];

/**
 * The acervo of the Registro de Imóveis as a file: `?tipo=` one of the
 * tables (or "acervo", the whole of it in JSON), `?formato=` xlsx, csv or
 * json, `?livro=` 2 or 3 to keep only one book. It carries CPF/CNPJ: only
 * who may generate the files for the ONR downloads it, and the audit says
 * who did.
 */
export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "ri.export", session.user.permissions)
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  if (!tenant.attributions.includes("RI")) {
    return new Response("Não encontrado", { status: 404 });
  }
  const params = new URL(request.url).searchParams;
  const kind = KINDS.find((k) => k === params.get("tipo"));
  const formatRaw = params.get("formato") ?? "xlsx";
  const format = (Object.keys(TRANSFER_FORMATS) as TransferFormat[]).find(
    (f) => f === formatRaw,
  );
  if (!kind || !format) {
    return new Response("Escolha o que exportar e o formato.", { status: 400 });
  }
  const bookRaw = params.get("livro");
  const book = bookRaw === "2" ? 2 : bookRaw === "3" ? 3 : null;
  const file = await transferExportWith(
    db,
    tenant.slug,
    kind,
    kind === "acervo" ? "json" : format,
    { id: session.user.id },
    book,
  );
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.type,
      "Content-Disposition": `attachment; filename="${file.name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
