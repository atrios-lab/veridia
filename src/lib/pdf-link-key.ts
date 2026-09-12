import { createHmac } from "node:crypto";

/**
 * The key `signPdfLink` and `verifyPdfLink` use, derived once per process.
 *
 * Derived from BETTER_AUTH_SECRET rather than read from a variable of its
 * own: every environment already has that one (auth.ts refuses to start
 * without it), and a second variable is one more thing to set by hand in
 * production and in Preview, the kind of step that goes missing on a deploy
 * and only shows up as a citizen who cannot open a PDF.
 *
 * Derived, not reused as-is: the purpose label means a leaked link token
 * says nothing about sessions and a leaked session secret is not directly a
 * link-signing key. Rotating the auth secret rotates this one with it, and
 * every outstanding link dies, which for a one-hour link is nothing lost.
 */
const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) {
  throw new Error(
    "BETTER_AUTH_SECRET nao esta definida. Gere com: openssl rand -base64 32",
  );
}

export const pdfLinkKey: Buffer = createHmac("sha256", secret)
  .update("veridia:pdf-link")
  .digest();
