import "server-only";
import {
  type OfficeIdentification,
  officeIdentification,
} from "@/core/tenant/identification.ts";
import type { Palette } from "@/core/tenant/palette.ts";
import { paletteFor } from "@/core/tenant/palette.ts";
import type { Tenant } from "@/core/tenant/schema.ts";

/**
 * What a drawn document needs to know about the office, and nothing else.
 * `src/lib/pdf.ts` takes this instead of the tenant so it stays drawing code:
 * it has no idea what a serventia is.
 *
 * No logotype: the Código de Normas da CGJ/TJRN (Provimento 156/2016, art.
 * 2º, § 1º) bars it from the office's papers, which carry the national arms
 * and the office's identification instead (`identification`).
 */
export interface DocumentBrand {
  palette: Palette;
  /** The office's identification, as its papers print it. Absent only on a
      brand built by hand, where the document's own office lines stand in. */
  identification?: OfficeIdentification;
  /** Where the QR in the letterhead points: the protocol lookup page. */
  lookupUrl?: string;
}

export async function brandFor(
  tenant: Tenant,
  lookupUrl?: string,
): Promise<DocumentBrand> {
  return {
    palette: paletteFor(tenant.theme),
    identification: officeIdentification(tenant),
    lookupUrl,
  };
}
