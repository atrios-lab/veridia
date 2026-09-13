import { db } from "@/db/index.ts";
import { getTenant } from "@/lib/tenant.ts";
import { handleRequerimentoLinkWith } from "./handle-link.ts";

export const runtime = "nodejs";

/**
 * The GET the POST in `../route.ts` redirects to. The actual work is
 * `handleRequerimentoLinkWith`, in its own file: this route only resolves
 * the tenant and hands the request over. See handle-link.ts and design.md,
 * decision 8.
 */
export async function GET(request: Request): Promise<Response> {
  const tenant = await getTenant();
  return handleRequerimentoLinkWith(db, tenant, request);
}
