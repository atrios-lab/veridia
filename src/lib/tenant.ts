import "server-only";
import { headers } from "next/headers";
import { resolveTenant } from "@/core/tenant/resolve.ts";
import type { Tenant } from "@/core/tenant/schema.ts";

/**
 * Resolves the office for the current request. Server only: the host header
 * is the only input, so a client component could never get this right.
 */
export async function getTenant(): Promise<Tenant> {
  const headerList = await headers();
  return resolveTenant(
    headerList.get("host") ?? undefined,
    process.env.DEFAULT_TENANT ?? "cartorio-marinho",
  );
}
