import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import {
  FeeTableError,
  feeTablePdfWith,
  feeTablePlanSchema,
} from "@/lib/custas.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * The new table as a PDF, to check or keep before publishing (decision of
 * 22/11/2026: "dá a opção de baixar o pdf"). POST: the plan is too large
 * for a link.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(
      session.user.role ?? "",
      "transparency.manage",
      session.user.permissions,
    )
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const form = await request.formData();
  const parsed = feeTablePlanSchema.safeParse(
    (() => {
      try {
        return JSON.parse(String(form.get("plano") ?? "{}"));
      } catch {
        return {};
      }
    })(),
  );
  if (!parsed.success) {
    return new Response("Preencha os campos da nova tabela.", { status: 400 });
  }
  try {
    const { bytes } = await feeTablePdfWith(db, tenant.slug, parsed.data);
    const name =
      parsed.data.documentTitle
        .replace(/[^\p{L}\p{N} ._-]/gu, "")
        .slice(0, 120) || "tabela-de-custas";
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="tabela-de-custas.pdf"; filename*=UTF-8''${encodeURIComponent(name)}.pdf`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof FeeTableError)
      return new Response(error.message, { status: 422 });
    console.error("custas.pdf", error);
    return new Response("Não foi possível gerar o PDF.", { status: 500 });
  }
}
