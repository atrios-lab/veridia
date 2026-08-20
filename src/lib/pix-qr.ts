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
 * amount, the office's Pix key and its city all at once: missing any one
 * of the three means "no QR yet", never a broken or partial one (see
 * `openspec/changes/add-request-payment-qr/design.md`, decision 4).
 */
export async function pixChargeFor(
  tenant: Tenant,
  protocolNumber: string,
  amountCents: number,
): Promise<PixCharge | undefined> {
  const pixKey = tenant.pix?.key;
  const city = tenant.pix?.city;
  if (!canBuildPixCharge({ amountCents, pixKey, city })) return undefined;

  const copyPaste = buildPixCharge({
    pixKey: pixKey as string,
    city: city as string,
    merchantName: tenant.name,
    amountCents,
    protocolNumber,
  });
  const qrSvg = await QRCode.toString(copyPaste, { type: "svg", margin: 1 });
  return { copyPaste, qrSvg };
}
