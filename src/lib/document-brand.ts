import "server-only";
import { accessSync, constants } from "node:fs";
import { join } from "node:path";
import type { Palette } from "@/core/tenant/palette.ts";
import { paletteFor } from "@/core/tenant/palette.ts";
import type { Tenant } from "@/core/tenant/schema.ts";

/**
 * What a drawn document needs to know about the office, and nothing else.
 * `src/lib/pdf.ts` takes this instead of the tenant so it stays drawing code:
 * it has no idea what a serventia is.
 */
export interface DocumentBrand {
  palette: Palette;
  /** Absolute path to a PNG. Absent when the office has no readable logo. */
  sealPath?: string;
  /** Where the QR in the letterhead points: the protocol lookup page. */
  lookupUrl?: string;
}

function readablePath(publicPath: string): string | undefined {
  // The tenant stores a public URL ("/logos/x.png"); PDFKit needs a file.
  const path = join(process.cwd(), "public", publicPath.replace(/^\//, ""));
  try {
    accessSync(path, constants.R_OK);
    return path;
  } catch {
    // A missing seal prints a letterhead without one. It must never be the
    // reason a citizen cannot download their requerimento.
    return undefined;
  }
}

export function brandFor(tenant: Tenant, lookupUrl?: string): DocumentBrand {
  return {
    palette: paletteFor(tenant.theme),
    // The letterhead is white paper, so the seal is the office's version for
    // light backgrounds.
    sealPath: readablePath(tenant.logos.seal.light),
    lookupUrl,
  };
}
