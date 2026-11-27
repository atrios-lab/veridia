import { writtenDate } from "@/core/ri/books.ts";
import { quarterOf, recipientsFor } from "@/core/ri/foreign.ts";
import { db } from "@/db/index.ts";
import { brandFor } from "@/lib/document-brand.ts";
import { renderDocuments, renderingFor } from "@/lib/pdf.ts";
import { signerLines } from "@/lib/ri-books.ts";
import {
  entriesOfQuarter,
  foreignQuarterDocument,
  listForeignWith,
} from "@/lib/ri-foreign.ts";
import { officeToday } from "@/lib/ri-protocols.ts";
import { getTenant } from "@/lib/tenant.ts";
import { canReadForeign } from "../_access.ts";

export const runtime = "nodejs";

/**
 * The relação of a trimestre (`?ano=&trimestre=`), one page per
 * destinatário (Prov. 156/RN, art. 275), or the certidão negativa.
 */
export function GET(request: Request) {
  return renderingFor(request, async () => {
    if (!(await canReadForeign())) {
      return new Response("Não autorizado", { status: 403 });
    }
    const tenant = await getTenant();
    const query = new URL(request.url).searchParams;
    const today = officeToday();
    const now = quarterOf(today);
    const year = Number(query.get("ano")) || now.year;
    const quarter = Math.min(
      4,
      Math.max(1, Number(query.get("trimestre")) || now.quarter),
    );
    const rows = entriesOfQuarter(
      await listForeignWith(db, tenant.slug),
      year,
      quarter,
    );
    const signer = await signerLines(
      tenant,
      query.get("assinatura") === "imagem",
    );
    const dateLine = `${tenant.location.city}/${tenant.location.state}, ${writtenDate(today)}.`;
    const pdf = await renderDocuments(
      recipientsFor(rows).map((recipient) =>
        foreignQuarterDocument(
          tenant,
          rows,
          year,
          quarter,
          recipient,
          dateLine,
          signer,
        ),
      ),
      await brandFor(tenant),
    );
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="estrangeiros-${year}-${quarter}tri.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  });
}
