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
  /** The seal image itself: a file path, or the bytes of an uploaded one.
      Absent when the office has no readable logo. */
  seal?: string | Buffer;
  /** Where the QR in the letterhead points: the protocol lookup page. */
  lookupUrl?: string;
}

/**
 * The seal as PDFKit can draw it. Two kinds of stored image reach here: the
 * file this repo ships, which is a path under `public/`, and one the office
 * sent from the panel, which is an absolute URL in the blob store and has to
 * be fetched.
 *
 * Every failure is the same answer: undefined. A missing seal prints a
 * letterhead without one. It must never be the reason a citizen cannot
 * download their requerimento.
 */
async function readableSeal(
  stored: string,
): Promise<string | Buffer | undefined> {
  if (/^https?:\/\//.test(stored)) {
    try {
      const response = await fetch(stored);
      if (!response.ok) return undefined;
      return Buffer.from(await response.arrayBuffer());
    } catch {
      return undefined;
    }
  }

  const path = join(process.cwd(), "public", stored.replace(/^\//, ""));
  try {
    accessSync(path, constants.R_OK);
    return path;
  } catch {
    return undefined;
  }
}

export async function brandFor(
  tenant: Tenant,
  lookupUrl?: string,
): Promise<DocumentBrand> {
  return {
    palette: paletteFor(tenant.theme),
    // The letterhead is white paper, so the seal is the office's version for
    // light backgrounds.
    seal: await readableSeal(tenant.logos.seal.light),
    lookupUrl,
  };
}
