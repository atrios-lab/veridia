import type { Tenant } from "./schema.ts";
import { tabelionatoAurora } from "./tenants/aurora.ts";
import { cartorioMarinho } from "./tenants/marinho.ts";

// Registry of offices (config as code). Every new office is added here.
export const TENANTS: Record<string, Tenant> = {
  [cartorioMarinho.slug]: cartorioMarinho,
  [tabelionatoAurora.slug]: tabelionatoAurora,
};

/** Lowercases the host and drops the port and the "www." prefix. */
export function normalizeHost(host: string | undefined): string {
  const withoutPort = (host ?? "").toLowerCase().trim().split(":")[0];
  return withoutPort.replace(/^www\./, "");
}

// Host to slug map, derived from the hosts declared in each config.
const HOST_MAP: Record<string, string> = Object.fromEntries(
  Object.values(TENANTS).flatMap((t) =>
    t.hosts.map((h) => [normalizeHost(h), t.slug]),
  ),
);

/** True when the host belongs to a registered office. */
export function isRegisteredHost(host: string | undefined): boolean {
  const normalized = normalizeHost(host);
  return normalized !== "" && normalized in HOST_MAP;
}

/**
 * Resolves the office from the request host, falling back to the default slug
 * when the host is not mapped. A broken fallback throws instead of silently
 * serving another office's data, which is the failure that actually hurts.
 */
export function resolveTenant(
  host: string | undefined,
  defaultSlug: string,
): Tenant {
  const normalized = normalizeHost(host);
  const slug = (normalized && HOST_MAP[normalized]) || defaultSlug;
  const tenant = TENANTS[slug];
  if (!tenant) {
    throw new Error(`Serventia nao encontrada para o slug "${slug}".`);
  }
  return tenant;
}
