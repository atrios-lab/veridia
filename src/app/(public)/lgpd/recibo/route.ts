import { db } from "@/db/index.ts";
import { getTenant } from "@/lib/tenant.ts";
import { handleDataRightsReceiptWith } from "./handle-receipt.ts";

export const runtime = "nodejs";

/**
 * POST, not GET: the receipt carries the holder's name, e-mail and what they
 * asked the office about their own data, and the key that opens it would
 * otherwise sit in the address bar and in every log on the way.
 *
 * The actual work is `handleDataRightsReceiptWith`, in its own file: this
 * route only resolves the tenant and hands the request over. See
 * handle-receipt.ts and design.md, decision 8.
 */
export async function POST(request: Request): Promise<Response> {
  const tenant = await getTenant();
  const form = await request.formData();
  return handleDataRightsReceiptWith(
    db,
    tenant,
    form,
    new URL(request.url).origin,
  );
}
