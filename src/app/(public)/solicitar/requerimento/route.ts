import { db } from "@/db/index.ts";
import { getTenant } from "@/lib/tenant.ts";
import { handleRequerimentoDownloadWith } from "./handle-download.ts";

export const runtime = "nodejs";

/**
 * POST, not GET: the form carries the access key, and a key in the query
 * string ends up in the address bar, in the browser history and in every log
 * between here and the citizen.
 *
 * The PDF holds the applicant's name, contact and what they asked the office
 * for, so the key is what stands between it and anyone with the protocol.
 *
 * Three documents are picked by the `documento` field, and they leave here
 * two different ways.
 *
 * The requerimento and the declaração de hipossuficiência (Provimento
 * CGJ/TJRN n. 7/2026, Anexo I) are not sent back in this response. They are
 * answered with a redirect to a signed GET link (see `[arquivo]/route.ts`),
 * because the browser's PDF viewer saves a file by fetching the tab's URL
 * again, by GET, and a tab reached by POST has nothing to fetch: Chrome's
 * download button answered "site unavailable" for every one of these files.
 * The link carries a token, never the key.
 *
 * The access receipt prints the key itself, so there is no link that could
 * serve it without being the key. It is answered here, as a download: the
 * browser saves it straight from this response and never opens a viewer.
 *
 * The actual work is `handleRequerimentoDownloadWith`, in its own file: this
 * route only resolves the tenant and hands the request over. See
 * handle-download.ts and design.md, decision 8.
 */
export async function POST(request: Request): Promise<Response> {
  const tenant = await getTenant();
  const form = await request.formData();
  return handleRequerimentoDownloadWith(
    db,
    tenant,
    form,
    new URL(request.url).origin,
  );
}
