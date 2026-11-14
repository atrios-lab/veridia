import "server-only";
import { can } from "@/core/auth/roles.ts";
import { officialName } from "@/core/tenant/identification.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import type { OfficeForExport } from "@/core/titularidade/exports.ts";
import { getSession } from "@/lib/session.ts";

/** Whether the request may download the titularidade files. */
export async function mayDownload(): Promise<boolean> {
  const session = await getSession();
  return Boolean(
    session &&
      can(
        session.user.role ?? "",
        "titularidade.manage",
        session.user.permissions,
      ),
  );
}

export function officeForExport(tenant: Tenant): OfficeForExport {
  return {
    name: officialName(tenant),
    city: tenant.location.city,
    state: tenant.location.state,
    cns: tenant.cns,
  };
}

/** A download the browser saves with its own name. */
export function download(
  body: string | Uint8Array,
  name: string,
  type: string,
) {
  return new Response(typeof body === "string" ? body : new Uint8Array(body), {
    headers: {
      "Content-Type":
        type.includes("charset") || type.startsWith("application/vnd")
          ? type
          : `${type}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
