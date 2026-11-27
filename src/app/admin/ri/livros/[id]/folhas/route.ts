import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { renderingFor } from "@/lib/pdf.ts";
import { bookSheetsPdf, bookSheetsWith } from "@/lib/ri-protocol-sheets.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * The folhas of the Livro 1 printed from the system, face by face, in the
 * columns of the book (Número de Ordem, Mês, Dia, Apresentante, Natureza,
 * Anotações) with the termo of each day below its títulos.
 * `?folha=75&ate_folha=80` or `?de=AAAA-MM-DD&ate=AAAA-MM-DD` narrow it.
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
  const sheets = await bookSheetsWith(db, tenant, (await params).id);
  if (!sheets) {
    return new Response(
      "Este livro ainda não tem as folhas definidas (a partir de qual número e folha).",
      { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }
  const query = new URL(request.url).searchParams;
  const num = (key: string) => {
    const n = Number(query.get(key));
    return Number.isInteger(n) && n > 0 ? n : undefined;
  };
  const iso = (key: string) => {
    const v = query.get(key);
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
  };
  const bytes = await bookSheetsPdf(tenant, sheets, {
    fromSheet: num("folha"),
    toSheet: num("ate_folha"),
    fromDay: iso("de"),
    toDay: iso("ate"),
  });
  if (!bytes) {
    return new Response("Nenhuma folha nesse intervalo.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Livro 1 - Protocolo - folhas.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export function GET(...args: Parameters<typeof handle>) {
  return renderingFor(args[0], () => handle(...args));
}
