import { transfersCsv } from "@/core/titularidade/documents.ts";
import {
  ctpJson,
  ctpTxt,
  ctpXml,
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
 * CTP (XML, JSON, TXT, CSV).
 */
export async function GET(request: Request): Promise<Response> {
  if (!(await mayDownload())) {
    return new Response("Não autorizado", { status: 403 });
  }
  const url = new URL(request.url);
  const mes = url.searchParams.get("mes") ?? "";
  const formato = url.searchParams.get("formato") ?? "";
  // The DOI has its own item and route (Carga da DOI).
  if (
    !/^\d{4}-\d{2}$/.test(mes) ||
    !isExportFormat(formato) ||
    formato.startsWith("doi")
  ) {
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
  }[formato as "ctp-xml" | "ctp-json" | "ctp-txt" | "ctp-csv"]();
  const info = EXPORT_FORMATS[formato];
  return download(body, `carga-ctp-${mes}.${info.ext}`, info.type);
}
