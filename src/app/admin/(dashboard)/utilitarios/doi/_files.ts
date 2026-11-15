import "server-only";
import { can } from "@/core/auth/roles.ts";
import { schemaProblems } from "@/core/censec/schema.ts";
import { doiObject } from "@/core/titularidade/exports.ts";
import layout from "@/core/titularidade/layout-doiweb.json" with {
  type: "json",
};
import type { TitleTransfer } from "@/core/titularidade/titularidade.ts";
import { getSession } from "@/lib/session.ts";

/** Whether the request may download the DOI. */
export async function mayDownloadDoi(): Promise<boolean> {
  const session = await getSession();
  return Boolean(
    session &&
      can(session.user.role ?? "", "doi.manage", session.user.permissions),
  );
}

/**
 * What keeps the act's DOI out of the DOI-Web import: the RFB's own schema
 * (layout-doiweb.json) checked against the declaration.
 */
export function doiPending(t: TitleTransfer): string[] {
  return schemaProblems(doiObject([t]), layout as Record<string, unknown>).map(
    (p) => p.replace(/\s*\(\$[^)]*\)\s*$/, ""),
  );
}
