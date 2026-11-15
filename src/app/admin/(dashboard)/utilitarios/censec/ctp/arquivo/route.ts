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
import { download, officeForExport } from "../../../titularidade/_files.ts";
import { mayDownloadCensec } from "../../_access.ts";
import { ctpPending } from "../_ctp.ts";

export const runtime = "nodejs";

/**
 * The month's Carga CTP, inside the CENSEC's loads (decision of
 * 15/11/2026): the JSON the CENSEC takes (CTP › Cargas), with only the
 * acts of notas its schema accepts, and the XML, the TXT relação and the
 * spreadsheet for the prefeitura's own systems.
 */
export async function GET(request: Request): Promise<Response> {
  if (!(await mayDownloadCensec())) {
    return new Response("Não autorizado", { status: 403 });
  }
  const url = new URL(request.url);
  const mes = url.searchParams.get("mes") ?? "";
  const formato = url.searchParams.get("formato") ?? "";
  if (
    !/^\d{4}-\d{2}$/.test(mes) ||
    !isExportFormat(formato) ||
    !formato.startsWith("ctp")
  ) {
    return new Response("Escolha o mês e o formato.", { status: 400 });
  }
  const tenant = await getTenant();
  const office = officeForExport(tenant);
  const transfers = (await listTransfersWith(db, tenant.slug, mes)).map(
    (r) => r.transfer,
  );
  const ready = transfers.filter(
    (t) => t.service === "notas" && ctpPending(office, mes, t).length === 0,
  );
  const body = {
    "ctp-json": () => ctpJson(office, mes, ready),
    "ctp-xml": () => ctpXml(office, mes, ready),
    "ctp-txt": () => ctpTxt(office, mes, transfers),
    "ctp-csv": () => transfersCsv(transfers),
  }[formato as "ctp-xml" | "ctp-json" | "ctp-txt" | "ctp-csv"]();
  const info = EXPORT_FORMATS[formato];
  return download(body, `carga-ctp-${mes}.${info.ext}`, info.type);
}
