import { transfersCsv } from "@/core/titularidade/documents.ts";
import {
  ctpJson,
  ctpTxt,
  ctpXml,
  doiJson,
  doiPgd,
  doiXml,
  EXPORT_FORMATS,
  isExportFormat,
} from "@/core/titularidade/exports.ts";
import { db } from "@/db/index.ts";
import { getTenant } from "@/lib/tenant.ts";
import { listTransfersWith } from "@/lib/title-transfers.ts";
import { download, mayDownload, officeForExport } from "../_files.ts";

export const runtime = "nodejs";

/**
 * The month's files to attach to the systems that take them: the Carga
 * CTP (XML, JSON, TXT, CSV) and the DOI (JSON for the DOI-Web, XML).
 */
export async function GET(request: Request): Promise<Response> {
  if (!(await mayDownload())) {
    return new Response("Não autorizado", { status: 403 });
  }
  const url = new URL(request.url);
  const mes = url.searchParams.get("mes") ?? "";
  const formato = url.searchParams.get("formato") ?? "";
  if (!/^\d{4}-\d{2}$/.test(mes) || !isExportFormat(formato)) {
    return new Response("Escolha o mês e o formato.", { status: 400 });
  }
  const tenant = await getTenant();
  const transfers = (await listTransfersWith(db, tenant.slug, mes)).map(
    (r) => r.transfer,
  );
  const office = officeForExport(tenant);
  const body = {
    "ctp-xml": () => ctpXml(office, mes, transfers),
    "ctp-json": () => ctpJson(office, mes, transfers),
    "ctp-txt": () => ctpTxt(office, mes, transfers),
    "ctp-csv": () => transfersCsv(transfers),
    "doi-json": () => doiJson(transfers),
    "doi-xml": () => doiXml(transfers),
    "doi-pgd": () =>
      doiPgd(transfers, tenant.location.city, tenant.location.state),
  }[formato]();
  const info = EXPORT_FORMATS[formato];
  // The PGD imports a file named DOI.TXT.
  if (formato === "doi-pgd") return download(body, "DOI.TXT", info.type);
  const prefix = formato.startsWith("doi") ? "doi" : "carga-ctp";
  return download(body, `${prefix}-${mes}.${info.ext}`, info.type);
}
