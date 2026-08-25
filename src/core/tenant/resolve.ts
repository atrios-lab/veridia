import type { Tenant } from "./schema.ts";
import { tabelionatoAurora } from "./tenants/aurora.ts";
import { cartorioBentoFernandes } from "./tenants/bento-fernandes.ts";
import { cartorioBomJesus } from "./tenants/bom-jesus.ts";
import { cartorioMajorSales } from "./tenants/major-sales.ts";
import { cartorioMarinho } from "./tenants/marinho.ts";
import { cartorioSantaCruz2 } from "./tenants/santa-cruz.ts";
import { cartorioTaipu } from "./tenants/taipu.ts";

// Registry of offices (config as code). Every new office is added here.
export const TENANTS: Record<string, Tenant> = {
  [cartorioMarinho.slug]: cartorioMarinho,
  [tabelionatoAurora.slug]: tabelionatoAurora,
  [cartorioBomJesus.slug]: cartorioBomJesus,
  [cartorioMajorSales.slug]: cartorioMajorSales,
  [cartorioTaipu.slug]: cartorioTaipu,
  [cartorioBentoFernandes.slug]: cartorioBentoFernandes,
  [cartorioSantaCruz2.slug]: cartorioSantaCruz2,
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

/**
 * True when the slug names a registered office. Object.hasOwn, not "in":
 * "constructor" and "toString" are on every object's prototype, and this
 * predicate guards authorization.
 */
export function isRegisteredSlug(slug: string): boolean {
  return Object.hasOwn(TENANTS, slug);
}

/** True when the host belongs to a registered office. */
export function isRegisteredHost(host: string | undefined): boolean {
  const normalized = normalizeHost(host);
  return normalized !== "" && normalized in HOST_MAP;
}

/**
 * The hosts that are the platform's own rather than any office's: plain
 * localhost in development and Vercel's deploy URLs. Only these may fall
 * back to the default office; any other unmapped host is someone reaching a
 * site this deploy does not serve, and answering it with the default
 * office's brand and data is a cross-tenant leak (an office's host served
 * by a process that predates its registration, a typoed domain, a spoofed
 * Host header).
 */
export function isPlatformHost(host: string | undefined): boolean {
  const normalized = normalizeHost(host);
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized.endsWith(".vercel.app")
  );
}

/**
 * Resolves the office from the request host. The default slug answers only
 * on platform hosts (see `isPlatformHost`); an unmapped host that is not the
 * platform's own throws instead of silently serving another office's data,
 * which is the failure that actually hurts. Callers that can turn this into
 * a 404 should check `isRegisteredHost`/`isPlatformHost` first.
 */
export function resolveTenant(
  host: string | undefined,
  defaultSlug: string,
): Tenant {
  const normalized = normalizeHost(host);
  const mapped = normalized ? HOST_MAP[normalized] : undefined;
  if (!mapped && normalized && !isPlatformHost(normalized)) {
    throw new Error(`Host "${normalized}" nao pertence a nenhuma serventia.`);
  }
  const slug = mapped || defaultSlug;
  const tenant = TENANTS[slug];
  if (!tenant) {
    throw new Error(`Serventia nao encontrada para o slug "${slug}".`);
  }
  return tenant;
}
