import {
  actProblems,
  CENTRALS,
  type Central,
  isCentral,
  isQuinzena,
} from "@/core/censec/censec.ts";
import {
  censecJson,
  censecTxt,
  censecXml,
  hasTxt,
} from "@/core/censec/exports.ts";
import { db } from "@/db/index.ts";
import { listCensecActsWith } from "@/lib/censec.ts";
import { getTenant } from "@/lib/tenant.ts";
import { download } from "../../titularidade/_files.ts";
import { mayDownloadCensec } from "../_access.ts";

export const runtime = "nodejs";

/**
 * The quinzena's file for the CENSEC: JSON (all centrals or one), XML or
 * TXT of a central. Only the acts without pendência go in.
 */
export async function GET(request: Request): Promise<Response> {
  if (!(await mayDownloadCensec())) {
    return new Response("Não autorizado", { status: 403 });
  }
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const formato = url.searchParams.get("formato") ?? "";
  const central = url.searchParams.get("central") ?? "";
  if (!isQuinzena(q) || !["json", "xml", "txt"].includes(formato)) {
    return new Response("Escolha a quinzena e o formato.", { status: 400 });
  }
  if (formato !== "json" && !isCentral(central)) {
    return new Response("Escolha a central.", { status: 400 });
  }
  if (formato === "txt" && !hasTxt(central as Central)) {
    return new Response("O CEP vai em JSON ou XML.", { status: 400 });
  }
  const tenant = await getTenant();
  const acts = (await listCensecActsWith(db, tenant.slug, q))
    .map((s) => s.act)
    .filter((a) => actProblems(a).length === 0);
  const only = isCentral(central) ? (central as Central) : undefined;
  const name = `censec-${only ? CENTRALS[only].short.toLowerCase() : "cargas"}-${q}`;
  if (formato === "json") {
    return download(
      censecJson({ cns: tenant.cns }, q, acts, only),
      `${name}.json`,
      "application/json",
    );
  }
  if (formato === "xml") {
    return download(
      censecXml(only as Central, acts),
      `${name}.xml`,
      "application/xml",
    );
  }
  return download(
    censecTxt(only as Central, acts),
    `${name}.txt`,
    "text/plain",
  );
}
