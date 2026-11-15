import { doiJson, doiPgd, doiXml } from "@/core/titularidade/exports.ts";
import { db } from "@/db/index.ts";
import { getTenant } from "@/lib/tenant.ts";
import { getTransferWith } from "@/lib/title-transfers.ts";
import { download } from "../../../titularidade/_files.ts";
import { mayDownloadDoi } from "../../_files.ts";

export const runtime = "nodejs";

/** One act's DOI: JSON for the DOI-Web, DOI.TXT for the PGD, or XML. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!(await mayDownloadDoi())) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const found = await getTransferWith(db, tenant.slug, (await params).id);
  if (!found) return new Response("Não encontrado", { status: 404 });
  const formato = new URL(request.url).searchParams.get("formato");
  const name = `doi-${found.transfer.actDate || found.competence}`;
  if (formato === "pgd") {
    return download(
      doiPgd([found.transfer], tenant.location.city, tenant.location.state),
      "DOI.TXT",
      "text/plain",
    );
  }
  return formato === "xml"
    ? download(doiXml([found.transfer]), `${name}.xml`, "application/xml")
    : download(doiJson([found.transfer]), `${name}.json`, "application/json");
}
