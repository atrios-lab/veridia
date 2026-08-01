import "server-only";
import { headers } from "next/headers";
import { auth } from "./auth.ts";

/**
 * Authoritative session check: it hits the database, so a session revoked
 * there is gone on the very next request. Every admin route goes through it.
 */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}
