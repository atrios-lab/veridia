import { doiJson, doiXml } from "@/core/titularidade/exports.ts";
import { db } from "@/db/index.ts";
import { getTenant } from "@/lib/tenant.ts";
import { getTransferWith } from "@/lib/title-transfers.ts";
import { download, mayDownload } from "../../_files.ts";

export const runtime = "nodejs";

/** One act's DOI, to import in the DOI-Web (JSON) or keep (XML). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!(await mayDownload())) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const found = await getTransferWith(db, tenant.slug, (await params).id);
  if (!found) return new Response("Não encontrado", { status: 404 });
  const xml = new URL(request.url).searchParams.get("formato") === "xml";
  const name = `doi-${found.transfer.actDate || found.competence}`;
  return xml
    ? download(doiXml([found.transfer]), `${name}.xml`, "application/xml")
    : download(doiJson([found.transfer]), `${name}.json`, "application/json");
}
