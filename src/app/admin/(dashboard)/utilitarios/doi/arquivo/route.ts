import { doiJson, doiPgd, doiXml } from "@/core/titularidade/exports.ts";
import { doiOf } from "@/core/titularidade/titularidade.ts";
import { db } from "@/db/index.ts";
import { getTenant } from "@/lib/tenant.ts";
import { listTransfersWith } from "@/lib/title-transfers.ts";
import { download } from "../../titularidade/_files.ts";
import { doiPending, mayDownloadDoi } from "../_files.ts";

export const runtime = "nodejs";

/**
 * The month's DOI (IN RFB nº 2.186/2024): one declaration per act, in the
 * DOI-Web's JSON, the PGD's DOI.TXT or XML. Only the acts not yet
 * delivered and that the RFB's schema accepts go in.
 */
export async function GET(request: Request): Promise<Response> {
  if (!(await mayDownloadDoi())) {
    return new Response("Não autorizado", { status: 403 });
  }
  const url = new URL(request.url);
  const mes = url.searchParams.get("mes") ?? "";
  const formato = url.searchParams.get("formato") ?? "";
  if (!/^\d{4}-\d{2}$/.test(mes) || !["json", "pgd", "xml"].includes(formato)) {
    return new Response("Escolha o mês e o formato.", { status: 400 });
  }
  const tenant = await getTenant();
  const transfers = (await listTransfersWith(db, tenant.slug, mes))
    .map((r) => r.transfer)
    // Already delivered (act by act, at the lavratura) stays out: nothing
    // is declared twice.
    .filter((t) => !doiOf(t).sentOn && doiPending(t).length === 0);
  if (formato === "pgd") {
    return download(
      doiPgd(transfers, tenant.location.city, tenant.location.state),
      "DOI.TXT",
      "text/plain",
    );
  }
  return formato === "xml"
    ? download(doiXml(transfers), `doi-${mes}.xml`, "application/xml")
    : download(doiJson(transfers), `doi-${mes}.json`, "application/json");
}
