import type { Metadata } from "next";
import { PAGE_META } from "@/core/tenant/seo.ts";
import { getTenant } from "@/lib/tenant.ts";

/**
 * The `generateMetadata` of a public page, by its address: title and a
 * description that names the office. One line per page instead of a
 * `getTenant` call and a template in each, so a page cannot ship with the
 * site-wide description by forgetting to write its own, which is how all
 * thirteen came to share one sentence.
 *
 * Throws at module load for an address `PAGE_META` does not know: a typo
 * here should fail the build, not serve a page without a description.
 */
export function publicMetadata(path: string): () => Promise<Metadata> {
  const meta = PAGE_META[path];
  if (!meta) throw new Error(`Sem metadata para a página "${path}".`);
  return async function generateMetadata() {
    const tenant = await getTenant();
    return { title: meta.title, description: meta.description(tenant) };
  };
}
