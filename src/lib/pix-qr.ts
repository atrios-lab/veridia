import "server-only";
import QRCode from "qrcode";
import {
  buildPixCharge,
  canBuildPixCharge,
} from "@/core/payment/pix-charge.ts";
import type { Tenant } from "@/core/tenant/schema.ts";

export interface PixCharge {
  /** The "Copia e Cola" text: same payload the QR encodes. */
  copyPaste: string;
  /** Inline SVG markup, rendered on the server: no client JS, no
   * round-trip, and the payload (which carries the amount) never leaves
   * this request to a third-party QR-drawing service. */
  qrSvg: string;
}

/**
 * The charge for one request, or nothing when it can't be built. Needs the
 * amount and the office's Pix key together: missing either means "no QR
 * yet", never a broken or partial one. The office's city
 * (`tenant.municipality`) is a structural fact, always present, so it is
 * not part of the availability check (see
 * `openspec/changes/prefill-pix-city-from-tenant/design.md`).
 */
export async function pixChargeFor(
  tenant: Tenant,
  protocolNumber: string,
  amountCents: number,
): Promise<PixCharge | undefined> {
  const pixKey = tenant.pix?.key;
  if (!canBuildPixCharge({ amountCents, pixKey })) return undefined;

  const copyPaste = buildPixCharge({
    pixKey: pixKey as string,
    city: tenant.municipality,
    merchantName: tenant.name,
    amountCents,
    protocolNumber,
  });
  const qrSvg = await QRCode.toString(copyPaste, { type: "svg", margin: 1 });
  return { copyPaste, qrSvg };
}
